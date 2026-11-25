/* eslint-disable @typescript-eslint/no-require-imports */
const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { createHash } = require('node:crypto')
const directory = mkdtempSync(`${tmpdir()}/jara-quiz-`)
const HOUR = 3_600_000
Object.assign(process.env, {
  DATABASE_URL: `file:${directory}/test.db`, CHAIN_MODE: 'mock', TOPUP_PROVIDER: 'mock', GD_NGN_RATE: '1', CRON_SECRET: 'cron',
  QUIZ_EVENT_ID: 'test-event', QUIZ_START_AT: String(Date.now() - HOUR), QUIZ_END_AT: String(Date.now() + HOUR),
  QUIZ_PER_CORRECT_GD: '250', QUIZ_QUESTION_SECONDS: '25', QUIZ_QUESTIONS_PER_RUN: '10', QUIZ_POOL_CAP_GD: '2500', QUIZ_TOP10_POOL_GD: '10000', QUIZ_TOP10_PRIZE_NGN: '0', QUIZ_REQUIRE_FLOWSTATE: 'false',
})
const { db, run } = require('../src/lib/db.ts')
const users = require('../src/lib/users.ts')
const chain = require('../src/lib/chain.ts')
const quiz = require('../src/lib/quiz/service.ts')
const { QUIZ_QUESTIONS } = require('../src/lib/quiz/questions.ts')

async function player(root) {
  let user = await users.createUser()
  await users.updateUser(user.id, { connected: true, rootAddress: root ?? `0x${createHash('sha256').update(user.id).digest('hex').slice(0, 40)}` })
  return users.getUserById(user.id)
}
/** The displayed index of the right (or a wrong) answer for the question in play. Test-only: reads the server's key. */
async function choiceFor(view, right = true) {
  const a = (await run('SELECT question_id, option_order FROM quiz_answers WHERE run_id = ? AND idx = ?', [view.runId, view.question.index])).rows[0]
  const order = JSON.parse(String(a.option_order))
  const answer = QUIZ_QUESTIONS.find((q) => q.id === a.question_id).answer
  return right ? order.indexOf(answer) : order.findIndex((o) => o !== answer)
}
const balance = async (user) => Number(await chain.gdBalance(user.agentAddress)) / 1e18

test('the bank has enough distinct, well-formed questions with one valid answer each', () => {
  assert.ok(QUIZ_QUESTIONS.length >= 20)
  assert.equal(new Set(QUIZ_QUESTIONS.map((q) => q.id)).size, QUIZ_QUESTIONS.length)
  for (const q of QUIZ_QUESTIONS) {
    assert.equal(new Set(q.options).size, 4, q.id)
    assert.ok([0, 1, 2, 3].includes(q.answer), q.id)
  }
})

test('a run draws 10 distinct questions, never reveals the answer key, and resumes instead of restarting', async () => {
  const user = await player()
  const view = await quiz.startQuiz(user)
  assert.equal(view.total, 10)
  assert.equal(view.question.index, 0)
  assert.equal(view.question.options.length, 4)
  assert.equal(JSON.stringify(view).includes('"answer"'), false)
  const ids = JSON.parse(String((await run('SELECT question_ids FROM quiz_runs WHERE id = ?', [view.runId])).rows[0].question_ids))
  assert.equal(new Set(ids).size, 10)
  assert.equal((await quiz.startQuiz(user)).runId, view.runId)
})

test('one run per verified identity, even from a second Jara account', async () => {
  const first = await player()
  await quiz.startQuiz(first)
  const second = await player(first.rootAddress)
  await assert.rejects(quiz.startQuiz(second), (err) => err.code === 'already_played')
})

test('a correct answer pays G$ 250 exactly once; wrong and late answers pay nothing', async () => {
  const user = await player()
  let view = await quiz.startQuiz(user)
  const before = await balance(user)
  const right = await choiceFor(view)
  const first = await quiz.answerQuestion(user, { runId: view.runId, index: 0, choice: right })
  assert.equal(first.result.correct, true)
  assert.equal(first.result.correctOption, right)
  assert.equal(first.result.paidGd, 250)
  // The same answer arriving twice (retry, double tap) is not paid again.
  const replay = await quiz.answerQuestion(user, { runId: view.runId, index: 0, choice: right })
  assert.equal(replay.result, null)
  assert.equal(await balance(user), before + 250)
  assert.equal((await run("SELECT COUNT(*) AS n FROM activity WHERE user_id = ? AND type = 'reward'", [user.id])).rows[0].n, 1)

  view = first.run
  const wrong = await quiz.answerQuestion(user, { runId: view.runId, index: 1, choice: await choiceFor(view, false) })
  assert.equal(wrong.result.correct, false)
  view = wrong.run

  // Past the deadline (and the network allowance), even the right answer scores nothing.
  await run('UPDATE quiz_answers SET issued_at = ?, deadline = ? WHERE run_id = ? AND idx = 2', [Date.now() - 30_000, Date.now() - 5_000, view.runId])
  const late = await quiz.answerQuestion(user, { runId: view.runId, index: 2, choice: await choiceFor(view) })
  assert.equal(late.result.timedOut, true)
  assert.equal(late.run.question.index, 3)
  assert.equal(late.run.correct, 1)
  assert.equal(await balance(user), before + 250)
  assert.equal(late.run.totalMs >= 25_000, true)

  // Another account cannot answer this run.
  const stranger = await player()
  await assert.rejects(quiz.answerQuestion(stranger, { runId: view.runId, index: 3, choice: 0 }), /Unknown quiz run/)
})

test('per-answer payouts stop at the pool cap; the run still scores', async () => {
  const used = Number((await run("SELECT COALESCE(SUM(amount_gd), 0) AS n FROM quiz_budget WHERE pool = 'answers'")).rows[0].n)
  await run("INSERT INTO quiz_budget (id, event_id, pool, amount_gd, created_at) VALUES ('filler', 'test-event', 'answers', ?, ?)", [2500 - used, Date.now()])
  const user = await player()
  const view = await quiz.startQuiz(user)
  const r = await quiz.answerQuestion(user, { runId: view.runId, index: 0, choice: await choiceFor(view) })
  assert.equal(r.result.correct, true)
  assert.equal(r.result.payout, 'pool_empty')
  assert.equal(r.run.correct, 1)
  assert.equal(r.run.earnedGd, 0)
})

test('the vote gate blocks quiz entry until the wallet votes for Jara', async () => {
  const gate = require('../src/lib/quiz/gate.ts')
  const original = gate.votesForJara
  const voted = new Set()
  gate.votesForJara = async (root) => voted.has(root.toLowerCase())
  process.env.QUIZ_REQUIRE_FLOWSTATE = 'true'
  try {
    const user = await player()
    await assert.rejects(quiz.startQuiz(user), (err) => err.code === 'needs_flowstate')
    assert.equal((await quiz.quizHome(user)).supported, false)
    voted.add(user.rootAddress.toLowerCase())
    assert.equal((await quiz.quizHome(user)).supported, true)
    assert.equal((await quiz.startQuiz(user)).question.index, 0)
  } finally { process.env.QUIZ_REQUIRE_FLOWSTATE = 'false'; gate.votesForJara = original }
})

test('leaderboard ranks by correct answers then total time; Top 10 bonuses pay once after close', async () => {
  // Fresh event with an open pool, so earlier tests do not affect ranks.
  Object.assign(process.env, { QUIZ_EVENT_ID: 'board-event', QUIZ_POOL_CAP_GD: '100000' })
  const fast = await player(), slow = await player(), none = await player()
  for (const [user, rightCount, delay] of [[fast, 3, 0], [slow, 3, 4000], [none, 0, 0]]) {
    let view = await quiz.startQuiz(user)
    for (let i = 0; i < view.total; i++) {
      if (delay) await run('UPDATE quiz_answers SET issued_at = issued_at - ? WHERE run_id = ? AND idx = ?', [delay, view.runId, i])
      view = (await quiz.answerQuestion(user, { runId: view.runId, index: i, choice: await choiceFor(view, i < rightCount) })).run
    }
    assert.equal(view.finished, true)
  }
  const board = await quiz.leaderboard(slow)
  assert.deepEqual(board.top.map((p) => p.correct), [3, 3, 0])
  assert.equal(board.top[0].wallet.startsWith(fast.rootAddress.slice(0, 6)), true)
  assert.equal(board.you.rank, 2)
  assert.equal(JSON.stringify(board).includes(fast.rootAddress), false)

  await assert.rejects(quiz.finalizeTop10(), (err) => err.code === 'quiz_not_closed')
  process.env.QUIZ_END_AT = String(Date.now() - 1)
  const before = [await balance(fast), await balance(slow), await balance(none)]
  const result = await quiz.finalizeTop10()
  assert.deepEqual(result.bonuses.map((b) => [b.rank, b.amountGd, b.status]), [[1, 3000, 'paid'], [2, 2000, 'paid']])
  assert.deepEqual([await balance(fast) - before[0], await balance(slow) - before[1], await balance(none) - before[2]], [3000, 2000, 0])
  // Running it again pays nobody twice.
  await quiz.finalizeTop10()
  assert.equal(await balance(fast) - before[0], 3000)
  assert.equal((await quiz.leaderboard(null)).bonusPaid, true)
  await assert.rejects(quiz.startQuiz(await player()), (err) => err.code === 'quiz_closed')
})

test('naira prize: each of the Top 10 wins the same naira amount in G$, priced once, and nothing per answer when that is off', async () => {
  const saved = { ...process.env }
  Object.assign(process.env, { QUIZ_EVENT_ID: 'prize-event', QUIZ_START_AT: String(Date.now() - HOUR), QUIZ_END_AT: String(Date.now() + HOUR),
    QUIZ_PER_CORRECT_GD: '0', QUIZ_POOL_CAP_GD: '', QUIZ_TOP10_PRIZE_NGN: '5000', GD_NGN_RATE: '0.2' })
  try {
    assert.equal(quiz.quizConfig().configured, true)
    const winner = await player(), runnerUp = await player(), zero = await player()
    const before = [await balance(winner), await balance(runnerUp), await balance(zero)]
    for (const [user, rightCount] of [[winner, 5], [runnerUp, 2], [zero, 0]]) {
      let view = await quiz.startQuiz(user)
      for (let i = 0; i < view.total; i++) view = (await quiz.answerQuestion(user, { runId: view.runId, index: i, choice: await choiceFor(view, i < rightCount) })).run
    }
    assert.equal(await balance(winner), before[0], 'no G$ per answer when QUIZ_PER_CORRECT_GD=0')
    const board = await quiz.leaderboard(null)
    assert.deepEqual(board.top.map((p) => p.prizeNgn), [5000, 5000, 0])
    assert.equal((await quiz.quizHome(winner)).quiz.top10PrizeNgn, 5000)

    process.env.QUIZ_END_AT = String(Date.now() - 1)
    const result = await quiz.finalizeTop10()
    // ₦5,000 at ₦0.2 per G$ = G$ 25,000 each; nobody with zero correct answers.
    assert.deepEqual(result.bonuses.map((b) => [b.rank, b.amountGd, b.status]), [[1, 25000, 'paid'], [2, 25000, 'paid']])
    // The rate moving afterwards changes nothing: amounts were frozen and paid once.
    process.env.GD_NGN_RATE = '0.1'
    await quiz.finalizeTop10()
    assert.deepEqual([await balance(winner) - before[0], await balance(runnerUp) - before[1], await balance(zero) - before[2]].map(Math.round), [25000, 25000, 0])
    const activity = (await run("SELECT title FROM activity WHERE user_id = ? AND type = 'reward'", [winner.id])).rows
    assert.deepEqual(activity.map((r) => r.title), ['Campus Quiz prize: #1 in the Top 10 (₦5,000 in G$)'])
  } finally {
    for (const k of ['QUIZ_EVENT_ID', 'QUIZ_START_AT', 'QUIZ_END_AT', 'QUIZ_PER_CORRECT_GD', 'QUIZ_POOL_CAP_GD', 'QUIZ_TOP10_PRIZE_NGN', 'GD_NGN_RATE']) process.env[k] = saved[k]
  }
})

after(async () => {
  ;(await db()).close()
  rmSync(directory, { recursive: true, force: true })
})
