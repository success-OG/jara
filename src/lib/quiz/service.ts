import { randomInt, randomUUID } from 'node:crypto'
import { parseEther } from 'viem'
import { sendGdFromTreasury } from '../chain'
import { rewardDestination } from '../claimers'
import { atomic, run } from '../db'
import { serverConfig } from '../env'
import { withUserLock } from '../jars'
import { getUserById, type User } from '../users'
import { authorizedUser } from '../wallet-authorization'
import * as gate from './gate'
import { QUIZ_QUESTIONS, type QuizQuestion } from './questions'

// Campus Quiz. The server owns the clock: every question gets a deadline when it is issued, and an
// answer after it (plus a small network allowance) scores nothing. One run per verified identity
// (root wallet) per event, whichever Jara account it is played from.
//
// Leaderboard order: most correct answers, then least total answer time, then who finished first.
// Total answer time = for each question, the time from it being shown to the answer arriving,
// capped at the question limit; an unanswered question counts as the full limit.

export class QuizError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) { super(message) }
}

/** Allowance for the answer's trip to the server after the on-screen timer ends. */
export const NETWORK_GRACE_MS = 2_000
/** Top 10 bonus split, in percent of QUIZ_TOP10_POOL_GD, by rank. */
export const TOP10_SPLIT = [30, 20, 15, 10, 8, 6, 5, 3, 2, 1] as const

export type QuizPhase = 'off' | 'soon' | 'open' | 'closed'

export function quizConfig() {
  const q = serverConfig().quiz
  const problem = !q.startAt || !q.endAt ? 'QUIZ_START_AT and QUIZ_END_AT are not set'
    : q.endAt <= q.startAt ? 'QUIZ_END_AT must be after QUIZ_START_AT'
    : !Number.isSafeInteger(q.poolCapGd) || q.poolCapGd <= 0 ? 'QUIZ_POOL_CAP_GD is not set'
    : !Number.isSafeInteger(q.perCorrectGd) || q.perCorrectGd <= 0 ? 'QUIZ_PER_CORRECT_GD must be a positive whole number'
    : !Number.isSafeInteger(q.top10PoolGd) || q.top10PoolGd < 0 ? 'QUIZ_TOP10_POOL_GD must be a whole number'
    : !Number.isSafeInteger(q.questionsPerRun) || q.questionsPerRun < 1 || q.questionsPerRun > QUIZ_QUESTIONS.length ? `QUIZ_QUESTIONS_PER_RUN must be 1–${QUIZ_QUESTIONS.length}`
    : !Number.isFinite(q.questionSeconds) || q.questionSeconds < 5 ? 'QUIZ_QUESTION_SECONDS must be at least 5'
    : null
  return { ...q, configured: problem === null, problem }
}

export function quizPhase(cfg = quizConfig(), now = Date.now()): QuizPhase {
  if (!cfg.configured) return 'off'
  return now < cfg.startAt ? 'soon' : now < cfg.endAt ? 'open' : 'closed'
}

const questionById = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q]))
function question(id: string): QuizQuestion {
  const q = questionById.get(id)
  if (!q) throw new QuizError('This question is no longer available.', 500)
  return q
}

function sample<T>(items: readonly T[], n: number): T[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) { const j = randomInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]] }
  return pool.slice(0, n)
}

type RunRow = { id: string; event_id: string; root_address: string; user_id: string; question_ids: string; current: number; correct: number; total_ms: number; earned_gd: number; started_at: number; finished_at: number | null }
type AnswerRow = { run_id: string; idx: number; question_id: string; option_order: string; issued_at: number; deadline: number; answered_at: number | null; choice: number | null; correct: number | null; elapsed_ms: number | null; payout: string; paid_gd: number; tx_hash: string | null }

async function getRun(id: string): Promise<RunRow | null> {
  return ((await run('SELECT * FROM quiz_runs WHERE id = ?', [id])).rows[0] as unknown as RunRow) ?? null
}
async function getAnswer(runId: string, idx: number): Promise<AnswerRow | null> {
  return ((await run('SELECT * FROM quiz_answers WHERE run_id = ? AND idx = ?', [runId, idx])).rows[0] as unknown as AnswerRow) ?? null
}

async function issue(r: RunRow, idx: number, now = Date.now()) {
  const ids = JSON.parse(r.question_ids) as string[]
  const limit = quizConfig().questionSeconds * 1000
  await run('INSERT OR IGNORE INTO quiz_answers (run_id, idx, question_id, option_order, issued_at, deadline) VALUES (?, ?, ?, ?, ?, ?)',
    [r.id, idx, ids[idx], JSON.stringify(sample([0, 1, 2, 3], 4)), now, now + limit])
}

/** Move past an answered question: issue the next one (its clock starts now) or finish the run. */
async function advance(runId: string) {
  const r = await getRun(runId)
  if (!r || r.finished_at) return
  const current = await getAnswer(r.id, r.current)
  if (current && current.answered_at === null) return
  const total = (JSON.parse(r.question_ids) as string[]).length
  const cfg = quizConfig()
  const now = Date.now()
  if (!current) { await issue(r, r.current, now); return }
  if (r.current + 1 >= total || now >= cfg.endAt) {
    await finishRun(r.id, now)
    return
  }
  const moved = await run('UPDATE quiz_runs SET current = current + 1 WHERE id = ? AND current = ? AND finished_at IS NULL', [r.id, r.current])
  if (moved.rowsAffected) await issue({ ...r, current: r.current + 1 }, r.current + 1, now)
}

/** Unanswered questions (including any never shown) count as the full time limit. */
async function finishRun(runId: string, now = Date.now()) {
  const limit = quizConfig().questionSeconds * 1000
  await atomic(async (tx) => {
    const r = (await tx.execute({ sql: 'SELECT * FROM quiz_runs WHERE id = ?', args: [runId] })).rows[0] as unknown as RunRow
    if (!r || r.finished_at) return
    const total = (JSON.parse(r.question_ids) as string[]).length
    const answered = (await tx.execute({ sql: 'SELECT COUNT(*) AS n FROM quiz_answers WHERE run_id = ? AND answered_at IS NOT NULL', args: [runId] })).rows[0]
    const open = await tx.execute({ sql: 'UPDATE quiz_answers SET answered_at = deadline, correct = 0, elapsed_ms = ? WHERE run_id = ? AND answered_at IS NULL', args: [limit, runId] })
    const missing = total - Number(answered.n) - open.rowsAffected
    await tx.execute({ sql: 'UPDATE quiz_runs SET total_ms = total_ms + ?, finished_at = ? WHERE id = ? AND finished_at IS NULL', args: [(open.rowsAffected + Math.max(0, missing)) * limit, now, runId] })
  })
}

/** A question whose deadline passed without an answer scores nothing and the run moves on. */
async function expireCurrent(runId: string, now = Date.now()) {
  const r = await getRun(runId)
  if (!r || r.finished_at) return
  const a = await getAnswer(r.id, r.current)
  if (!a || a.answered_at !== null || now <= a.deadline + NETWORK_GRACE_MS) return
  const limit = quizConfig().questionSeconds * 1000
  await atomic(async (tx) => {
    const done = await tx.execute({ sql: 'UPDATE quiz_answers SET answered_at = ?, correct = 0, elapsed_ms = ? WHERE run_id = ? AND idx = ? AND answered_at IS NULL', args: [a.deadline, limit, r.id, r.current] })
    if (done.rowsAffected) await tx.execute({ sql: 'UPDATE quiz_runs SET total_ms = total_ms + ? WHERE id = ?', args: [limit, r.id] })
  })
  await advance(r.id)
}

/** What the player sees. The answer key is never included for a question still in play. */
async function runView(runId: string) {
  await expireCurrent(runId)
  await advance(runId)
  const r = (await getRun(runId))!
  const total = (JSON.parse(r.question_ids) as string[]).length
  const a = r.finished_at ? null : await getAnswer(r.id, r.current)
  const q = a ? question(a.question_id) : null
  const order = a ? (JSON.parse(a.option_order) as number[]) : []
  const pending = Number((await run("SELECT COUNT(*) AS n FROM quiz_answers WHERE run_id = ? AND payout IN ('reserved', 'retry')", [r.id])).rows[0].n)
  return {
    runId: r.id,
    total,
    correct: Number(r.correct),
    earnedGd: Number(r.earned_gd),
    totalMs: Number(r.total_ms),
    finished: Boolean(r.finished_at),
    payoutsPending: pending,
    question: a && q ? { index: Number(a.idx), topic: q.topic, prompt: q.prompt, options: order.map((i) => q.options[i]), deadline: Number(a.deadline), serverNow: Date.now() } : null,
  }
}

export type QuizRunView = Awaited<ReturnType<typeof runView>>

async function gateMet(user: User): Promise<boolean> {
  if (!quizConfig().requireFlowstate) return true
  return gate.votesForJara(user.rootAddress!)
}

export async function startQuiz(input: User) {
  const cfg = quizConfig()
  const phase = quizPhase(cfg)
  if (phase !== 'open') throw new QuizError(phase === 'soon' ? 'The Campus Quiz has not started yet.' : phase === 'closed' ? 'The Campus Quiz has closed.' : 'The Campus Quiz is not open.', 409, `quiz_${phase}`)
  if (!input.connected || !input.rootAddress) throw new QuizError('Connect your verified GoodDollar wallet to play.', 409, 'not_connected')
  const user = await authorizedUser(input)
  const root = user.rootAddress!.toLowerCase()
  return withUserLock(user.id, async () => {
    const existing = (await run('SELECT id, user_id FROM quiz_runs WHERE event_id = ? AND root_address = ?', [cfg.eventId, root])).rows[0]
    if (existing) {
      if (existing.user_id !== user.id) throw new QuizError('This GoodDollar identity has already played from another Jara account. One run per person.', 409, 'already_played')
      return runView(String(existing.id))
    }
    if (!(await gateMet(user))) throw new QuizError('Vote for Jara on Flowstate to unlock the quiz.', 403, 'needs_flowstate')
    const id = randomUUID()
    const ids = sample(QUIZ_QUESTIONS, cfg.questionsPerRun).map((q) => q.id)
    const created = await run('INSERT OR IGNORE INTO quiz_runs (id, event_id, root_address, user_id, question_ids, started_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, cfg.eventId, root, user.id, JSON.stringify(ids), Date.now()])
    if (!created.rowsAffected) throw new QuizError('This GoodDollar identity has already played. One run per person.', 409, 'already_played')
    return runView(id)
  }, { waitMs: 10_000 })
}

export async function quizRunFor(user: User) {
  if (!user.rootAddress) return null
  const row = (await run('SELECT id, user_id FROM quiz_runs WHERE event_id = ? AND root_address = ?', [quizConfig().eventId, user.rootAddress.toLowerCase()])).rows[0]
  if (!row) return null
  if (row.user_id !== user.id) return { playedElsewhere: true as const }
  return runView(String(row.id))
}

/** Reserve G$ in a pool before signing. A reservation is kept across retries and restarts. */
async function reserve(id: string, pool: 'answers' | 'top10', amountGd: number, capGd: number): Promise<boolean> {
  const eventId = quizConfig().eventId
  return atomic(async (tx) => {
    const prior = (await tx.execute({ sql: 'SELECT amount_gd FROM quiz_budget WHERE id = ?', args: [id] })).rows[0]
    if (prior) {
      if (Number(prior.amount_gd) !== amountGd) throw new Error('Quiz reservation amount changed')
      return true
    }
    const used = (await tx.execute({ sql: 'SELECT COALESCE(SUM(amount_gd), 0) AS n FROM quiz_budget WHERE event_id = ? AND pool = ?', args: [eventId, pool] })).rows[0]
    if (Number(used.n) + amountGd > capGd) return false
    await tx.execute({ sql: 'INSERT INTO quiz_budget (id, event_id, pool, amount_gd, created_at) VALUES (?, ?, ?, ?, ?)', args: [id, eventId, pool, amountGd, Date.now()] })
    return true
  })
}

/** Pay one correct answer, once. Safe to call again after any failure. */
async function payAnswer(user: User, r: RunRow, idx: number): Promise<{ status: string; paidGd: number }> {
  const cfg = quizConfig()
  const a = await getAnswer(r.id, idx)
  if (!a || Number(a.correct) !== 1) return { status: 'none', paidGd: 0 }
  if (a.payout === 'paid') return { status: 'paid', paidGd: Number(a.paid_gd) }
  if (a.payout === 'pool_empty') return { status: 'pool_empty', paidGd: 0 }
  const opId = `quiz:${r.event_id}:${r.root_address}:${idx}`
  const amountGd = cfg.perCorrectGd
  if (!(await reserve(opId, 'answers', amountGd, cfg.poolCapGd))) {
    await run("UPDATE quiz_answers SET payout = 'pool_empty' WHERE run_id = ? AND idx = ? AND payout != 'paid'", [r.id, idx])
    return { status: 'pool_empty', paidGd: 0 }
  }
  await run("UPDATE quiz_answers SET payout = 'reserved' WHERE run_id = ? AND idx = ? AND payout = 'none'", [r.id, idx])
  try {
    const amount = parseEther(String(amountGd))
    const hash = await sendGdFromTreasury(await rewardDestination(user, opId), amount, opId)
    await atomic(async (tx) => {
      const paid = await tx.execute({ sql: "UPDATE quiz_answers SET payout = 'paid', paid_gd = ?, tx_hash = ? WHERE run_id = ? AND idx = ? AND payout != 'paid'", args: [amountGd, hash, r.id, idx] })
      if (!paid.rowsAffected) return
      await tx.execute({ sql: 'UPDATE quiz_runs SET earned_gd = earned_gd + ? WHERE id = ?', args: [amountGd, r.id] })
      await tx.execute({ sql: 'INSERT OR IGNORE INTO rewards_paid (user_id, reward_key, amount_gd, created_at) VALUES (?, ?, ?, ?)', args: [user.id, `quiz:${r.event_id}:${idx}`, amountGd, Date.now()] })
      await tx.execute({ sql: "INSERT OR IGNORE INTO activity (user_id, type, amount_wei, tx_hash, title, operation_id, created_at) VALUES (?, 'reward', ?, ?, ?, ?, ?)", args: [user.id, String(amount), hash, 'Campus Quiz: correct answer', opId, Date.now()] })
    })
    return { status: 'paid', paidGd: amountGd }
  } catch (err) {
    console.error('[quiz] payout deferred', opId, err instanceof Error ? err.message : 'error')
    await run("UPDATE quiz_answers SET payout = 'retry' WHERE run_id = ? AND idx = ? AND payout != 'paid'", [r.id, idx])
    return { status: 'retry', paidGd: 0 }
  }
}

/** Finish any payouts that failed earlier (network, busy treasury). Never pays an answer twice. */
async function settleRun(user: User, r: RunRow) {
  const due = (await run("SELECT idx FROM quiz_answers WHERE run_id = ? AND correct = 1 AND payout IN ('none', 'reserved', 'retry')", [r.id])).rows
  for (const row of due) await payAnswer(user, r, Number(row.idx))
}

export async function answerQuestion(input: User, body: { runId?: unknown; index?: unknown; choice?: unknown }) {
  if (typeof body.runId !== 'string') throw new QuizError('Unknown quiz run.', 404)
  const user = input
  return withUserLock(user.id, async () => {
    const r = await getRun(body.runId as string)
    if (!r || r.user_id !== user.id) throw new QuizError('Unknown quiz run.', 404)
    const now = Date.now()
    if (r.finished_at || body.index !== r.current) return { result: null, run: await runView(r.id) }
    const a = await getAnswer(r.id, r.current)
    if (!a || a.answered_at !== null) return { result: null, run: await runView(r.id) }
    if (now > a.deadline + NETWORK_GRACE_MS) {
      await expireCurrent(r.id, now)
      return { result: { correct: false, timedOut: true, correctOption: null, payout: 'none', paidGd: 0 }, run: await runView(r.id) }
    }
    const choice = Number(body.choice)
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw new QuizError('Choose one of the four answers.')
    const order = JSON.parse(a.option_order) as number[]
    const q = question(a.question_id)
    const correct = order[choice] === q.answer
    const limit = quizConfig().questionSeconds * 1000
    const elapsed = Math.min(limit, Math.max(0, now - a.issued_at))
    const recorded = await atomic(async (tx) => {
      const done = await tx.execute({ sql: 'UPDATE quiz_answers SET answered_at = ?, choice = ?, correct = ?, elapsed_ms = ? WHERE run_id = ? AND idx = ? AND answered_at IS NULL', args: [now, choice, correct ? 1 : 0, elapsed, r.id, a.idx] })
      if (!done.rowsAffected) return false
      await tx.execute({ sql: 'UPDATE quiz_runs SET correct = correct + ?, total_ms = total_ms + ? WHERE id = ?', args: [correct ? 1 : 0, elapsed, r.id] })
      return true
    })
    if (!recorded) return { result: null, run: await runView(r.id) }
    // Pay before issuing the next question, so payout time never eats into the next question's clock.
    const pay = correct ? await payAnswer(user, r, a.idx) : { status: 'none', paidGd: 0 }
    await advance(r.id)
    await settleRun(user, r)
    return { result: { correct, timedOut: false, correctOption: order.indexOf(q.answer), payout: pay.status, paidGd: pay.paidGd }, run: await runView(r.id) }
  }, { waitMs: 15_000 })
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export async function leaderboard(viewer: User | null) {
  const cfg = quizConfig()
  const rows = (await run(`SELECT r.root_address, r.correct, r.total_ms, r.earned_gd, u.name FROM quiz_runs r JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ? AND r.finished_at IS NOT NULL ORDER BY r.correct DESC, r.total_ms ASC, r.finished_at ASC, r.id ASC LIMIT 10`, [cfg.eventId])).rows
  const players = Number((await run('SELECT COUNT(*) AS n FROM quiz_runs WHERE event_id = ? AND finished_at IS NOT NULL', [cfg.eventId])).rows[0].n)
  let you: { rank: number; correct: number; totalMs: number } | null = null
  if (viewer?.rootAddress) {
    const mine = (await run('SELECT correct, total_ms, finished_at, id FROM quiz_runs WHERE event_id = ? AND root_address = ? AND finished_at IS NOT NULL', [cfg.eventId, viewer.rootAddress.toLowerCase()])).rows[0]
    if (mine) {
      const ahead = (await run(`SELECT COUNT(*) AS n FROM quiz_runs WHERE event_id = ? AND finished_at IS NOT NULL AND (correct > ? OR (correct = ? AND total_ms < ?)
        OR (correct = ? AND total_ms = ? AND (finished_at < ? OR (finished_at = ? AND id < ?))))`,
      [cfg.eventId, mine.correct, mine.correct, mine.total_ms, mine.correct, mine.total_ms, mine.finished_at, mine.finished_at, mine.id])).rows[0]
      you = { rank: Number(ahead.n) + 1, correct: Number(mine.correct), totalMs: Number(mine.total_ms) }
    }
  }
  const bonus = (await run('SELECT rank, amount_gd, paid_at FROM quiz_bonus WHERE event_id = ? ORDER BY rank', [cfg.eventId])).rows
  return {
    eventId: cfg.eventId,
    phase: quizPhase(cfg),
    players,
    top: rows.map((x, i) => ({
      rank: i + 1,
      name: (x.name as string | null)?.trim() || 'Player',
      wallet: short(String(x.root_address)),
      correct: Number(x.correct),
      totalSeconds: Math.round(Number(x.total_ms) / 100) / 10,
      bonusGd: cfg.top10PoolGd && Number(x.correct) > 0 ? Math.floor((cfg.top10PoolGd * TOP10_SPLIT[i]) / 100) : 0,
    })),
    you,
    bonusPaid: bonus.length > 0 && bonus.every((b) => b.paid_at),
  }
}

/**
 * After the window closes: finish abandoned runs, retry deferred per-answer payouts, freeze the
 * Top 10 (players with at least one correct answer) and pay each bonus once.
 */
export async function finalizeTop10() {
  const cfg = quizConfig()
  if (quizPhase(cfg) !== 'closed') throw new QuizError('The quiz window has not closed yet.', 409, 'quiz_not_closed')
  for (const row of (await run('SELECT id FROM quiz_runs WHERE event_id = ? AND finished_at IS NULL', [cfg.eventId])).rows) await finishRun(String(row.id))
  let retried = 0
  for (const row of (await run(`SELECT DISTINCT r.* FROM quiz_runs r JOIN quiz_answers a ON a.run_id = r.id WHERE r.event_id = ? AND a.correct = 1 AND a.payout IN ('none', 'reserved', 'retry')`, [cfg.eventId])).rows) {
    const r = row as unknown as RunRow
    const user = await getUserById(r.user_id)
    if (user) { await withUserLock(user.id, () => settleRun(user, r), { waitMs: 15_000 }).catch(() => undefined); retried++ }
  }
  const top = (await run(`SELECT id, root_address, user_id FROM quiz_runs WHERE event_id = ? AND finished_at IS NOT NULL AND correct > 0
    ORDER BY correct DESC, total_ms ASC, finished_at ASC, id ASC LIMIT 10`, [cfg.eventId])).rows
  // Frozen on first finalize: a later re-run pays the same ranks to the same people.
  for (const [i, row] of top.entries()) {
    await run('INSERT OR IGNORE INTO quiz_bonus (event_id, rank, root_address, user_id, amount_gd) VALUES (?, ?, ?, ?, ?)',
      [cfg.eventId, i + 1, String(row.root_address), String(row.user_id), Math.floor((cfg.top10PoolGd * TOP10_SPLIT[i]) / 100)])
  }
  const results: { rank: number; amountGd: number; status: string }[] = []
  for (const b of (await run('SELECT * FROM quiz_bonus WHERE event_id = ? ORDER BY rank', [cfg.eventId])).rows) {
    const rank = Number(b.rank), amountGd = Number(b.amount_gd)
    if (b.paid_at) { results.push({ rank, amountGd, status: 'paid' }); continue }
    if (amountGd <= 0) { results.push({ rank, amountGd, status: 'none' }); continue }
    const user = await getUserById(String(b.user_id))
    if (!user) { results.push({ rank, amountGd, status: 'no_user' }); continue }
    const opId = `quiz:${cfg.eventId}:top:${rank}:${b.root_address}`
    try {
      if (!(await reserve(opId, 'top10', amountGd, cfg.top10PoolGd))) { results.push({ rank, amountGd, status: 'pool_empty' }); continue }
      const amount = parseEther(String(amountGd))
      const hash = await withUserLock(user.id, async () => sendGdFromTreasury(await rewardDestination(user, opId), amount, opId), { waitMs: 15_000 })
      await atomic(async (tx) => {
        const paid = await tx.execute({ sql: 'UPDATE quiz_bonus SET tx_hash = ?, paid_at = ? WHERE event_id = ? AND rank = ? AND paid_at IS NULL', args: [hash, Date.now(), cfg.eventId, rank] })
        if (!paid.rowsAffected) return
        await tx.execute({ sql: 'INSERT OR IGNORE INTO rewards_paid (user_id, reward_key, amount_gd, created_at) VALUES (?, ?, ?, ?)', args: [user.id, `quiz:${cfg.eventId}:top10`, amountGd, Date.now()] })
        await tx.execute({ sql: "INSERT OR IGNORE INTO activity (user_id, type, amount_wei, tx_hash, title, operation_id, created_at) VALUES (?, 'reward', ?, ?, ?, ?, ?)", args: [user.id, String(amount), hash, `Campus Quiz Top 10 bonus (#${rank})`, opId, Date.now()] })
      })
      results.push({ rank, amountGd, status: 'paid' })
    } catch (err) {
      console.error('[quiz] bonus payout deferred', opId, err instanceof Error ? err.message : 'error')
      results.push({ rank, amountGd, status: 'retry' })
    }
  }
  return { eventId: cfg.eventId, retriedRuns: retried, bonuses: results }
}

/** The quiz screen's first load: window, gate and the player's run. Database reads only. */
export async function quizHome(user: User | null) {
  const cfg = quizConfig()
  const phase = quizPhase(cfg)
  const used = Number((await run("SELECT COALESCE(SUM(amount_gd), 0) AS n FROM quiz_budget WHERE event_id = ? AND pool = 'answers'", [cfg.eventId])).rows[0].n)
  const played = user ? await quizRunFor(user) : null
  return {
    quiz: {
      eventId: cfg.eventId,
      phase,
      startAt: cfg.configured ? cfg.startAt : null,
      endAt: cfg.configured ? cfg.endAt : null,
      perCorrectGd: cfg.perCorrectGd,
      questionSeconds: cfg.questionSeconds,
      questionsPerRun: cfg.questionsPerRun,
      top10PoolGd: cfg.top10PoolGd,
      poolLeftGd: Math.max(0, cfg.poolCapGd - used),
      requireFlowstate: cfg.requireFlowstate,
    },
    signedIn: Boolean(user),
    connected: Boolean(user?.connected && user.rootAddress),
    // A live council read, only for a connected player who has not started yet.
    supported: !cfg.requireFlowstate || Boolean(played) || !user?.connected || !user.rootAddress ? true : await gate.votesForJara(user.rootAddress).catch(() => false),
    playedElsewhere: Boolean(played && 'playedElsewhere' in played),
    run: played && !('playedElsewhere' in played) ? played : null,
  }
}

export async function quizStats() {
  const cfg = quizConfig()
  const r = (await run('SELECT COUNT(*) AS runs, COALESCE(SUM(CASE WHEN finished_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS finished, COALESCE(SUM(earned_gd), 0) AS gd FROM quiz_runs WHERE event_id = ?', [cfg.eventId])).rows[0]
  return { eventId: cfg.eventId, runs: Number(r.runs), completed: Number(r.finished), paidGd: Number(r.gd) }
}
