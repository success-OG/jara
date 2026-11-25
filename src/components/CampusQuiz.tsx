'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, readApiResponse, responseMessage } from '@/lib/api-response'

type Question = { index: number; topic: string; prompt: string; options: string[]; deadline: number; serverNow: number }
type Run = { runId: string; total: number; correct: number; earnedGd: number; totalMs: number; finished: boolean; payoutsPending: number; question: Question | null }
type Home = {
  quiz: { eventId: string; phase: 'off' | 'soon' | 'open' | 'closed'; startAt: number | null; endAt: number | null; perCorrectGd: number; questionSeconds: number; questionsPerRun: number; top10PoolGd: number; top10PrizeNgn: number; poolLeftGd: number; requireFlowstate: boolean }
  signedIn: boolean; connected: boolean; supported: boolean; playedElsewhere: boolean; run: Run | null
}
type Result = { correct: boolean; timedOut: boolean; correctOption: number | null; payout: string; paidGd: number }
type Board = { players: number; top: { rank: number; name: string; wallet: string; correct: number; totalSeconds: number; bonusGd: number; prizeNgn: number }[]; you: { rank: number; correct: number; totalMs: number } | null; bonusPaid: boolean }

async function request<T>(url: string, body?: object): Promise<T> {
  const res = await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)
    .catch(() => { throw new ApiError('The connection was interrupted. Please try again.', 'network', 0, true) })
  return readApiResponse<T>(res)
}

const wat = (ms: number) => new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(ms) + ' WAT'
const gd = (n: number) => n.toLocaleString('en-US')
const card = 'app-card p-5 sm:p-6'
const primary = 'app-button justify-center bg-forest text-cream hover:bg-forest-soft disabled:opacity-60 min-h-12 text-sm'

export function CampusQuiz() {
  const [home, setHome] = useState<Home | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [last, setLast] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // Server clock minus this device's clock, so the countdown matches the server deadline.
  const [skew, setSkew] = useState(0)
  const lock = useRef(false)

  const show = useCallback((r: Run | null) => {
    setRun(r)
    if (r?.question) setSkew(r.question.serverNow - Date.now())
  }, [])
  const load = useCallback(async () => {
    const h = await request<Home>('/api/quiz')
    setHome(h); show(h.run)
  }, [show])

  useEffect(() => {
    let active = true
    request<Home>('/api/quiz')
      .then((h) => { if (active) { setHome(h); show(h.run) } })
      .catch((e) => { if (active) setError(responseMessage(e)) })
    return () => { active = false }
  }, [show])
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(id) }, [])

  const q = run?.question ?? null
  const left = q ? Math.max(0, q.deadline - (now + skew)) : 0
  // The server moves on once a deadline passes; fetch the next question when it does.
  useEffect(() => {
    if (!q || left > 0 || lock.current) return
    const t = window.setTimeout(() => {
      if (lock.current) return
      setLast({ correct: false, timedOut: true, correctOption: null, payout: 'none', paidGd: 0 })
      load().catch((e) => setError(responseMessage(e)))
    }, 2600)
    return () => window.clearTimeout(t)
  }, [q, left, load])

  const begin = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(null)
    try { show(await request<Run>('/api/quiz/start', {})); setLast(null) }
    catch (e) { setError(responseMessage(e)); if (e instanceof ApiError && e.code === 'needs_flowstate') await load() }
    finally { lock.current = false; setBusy(false) }
  }

  const answer = async (choice: number) => {
    if (lock.current || !run || !q) return
    lock.current = true; setBusy(true); setError(null)
    try {
      const r = await request<{ result: Result | null; run: Run }>('/api/quiz/answer', { runId: run.runId, index: q.index, choice })
      setLast(r.result); show(r.run)
    } catch (e) { setError(responseMessage(e)) }
    finally { lock.current = false; setBusy(false) }
  }

  if (!home) return <Shell><p className="text-sm font-semibold text-ink/55">{error ?? 'Loading the Campus Quiz…'}</p></Shell>
  const { quiz } = home
  const rules = (
    <ul className="grid gap-1.5 text-[15px] font-medium text-ink/75">
      <li>• {quiz.questionsPerRun} questions, {quiz.questionSeconds} seconds each</li>
      {quiz.top10PrizeNgn > 0 && <li>• <b>Top 10 each win ₦{gd(quiz.top10PrizeNgn)}</b>, paid in G$ to your wallet (most correct, then fastest)</li>}
      {quiz.top10PrizeNgn > 0 && <li>• Spend it on airtime and data right here in Jara</li>}
      {quiz.perCorrectGd > 0 && <li>• G$ {gd(quiz.perCorrectGd)} for every correct answer, paid to your wallet</li>}
      {quiz.top10PoolGd > 0 && <li>• Top 10 share a G$ {gd(quiz.top10PoolGd)} bonus (most correct, then fastest)</li>}
      <li>• One run per verified person. No repeats.</li>
    </ul>
  )

  return (
    <Shell>
      {quiz.phase === 'off' && <section className={card}><h1 className="text-2xl font-bold">Campus Quiz</h1><p className="mt-2 text-ink/65">The Campus Quiz isn’t open yet. Watch the Jara channels for the time.</p></section>}

      {quiz.phase === 'soon' && quiz.startAt && (
        <section className={card}>
          <p className="text-[11px] font-bold tracking-[0.14em] text-forest/70 uppercase">Campus launch</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Opens {wat(quiz.startAt)}</h1>
          <div className="mt-4">{rules}</div>
          {home.connected && quiz.requireFlowstate && !home.supported && <p className="mt-4 text-sm font-semibold text-ink/60">Get ready: vote for Jara on Flowstate (below) so you can play the moment it opens.</p>}
        </section>
      )}

      {(quiz.phase === 'open' || quiz.phase === 'soon') && !run && (
        !home.signedIn || !home.connected ? (
          <section className={card}>
            <h2 className="text-xl font-bold">Set up Jara to play</h2>
            <p className="mt-2 text-ink/65">Sign in and verify your GoodDollar wallet. Your quiz G$ goes to that wallet.</p>
            <Link href="/app" className={`${primary} mt-4`}>Set up Jara →</Link>
          </section>
        ) : home.playedElsewhere ? (
          <section className={card}><p className="font-bold">This GoodDollar identity already played from another Jara account. One run per person.</p></section>
        ) : quiz.requireFlowstate && !home.supported ? (
          <section className={card}>
            <h2 className="text-xl font-bold">Step 1 · Vote for Jara on Flowstate</h2>
            <p className="mt-1 text-sm text-ink/60">Give Jara at least one of your GoodBuilders community votes. It’s free: Jara covers the network fee. Then come back here to play.</p>
            <Link href="/app#vote" className={`${primary} mt-4 w-full`}>Vote for Jara →</Link>
            <button className="app-button-secondary mt-2 w-full justify-center" onClick={() => void load().catch((e) => setError(responseMessage(e)))}>I’ve voted · check again</button>
          </section>
        ) : quiz.phase === 'open' && (
          <section className={card}>
            <p className="text-[11px] font-bold tracking-[0.14em] text-forest/70 uppercase">Live now · closes {quiz.endAt ? wat(quiz.endAt) : ''}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Jara Campus Quiz</h1>
            <div className="mt-4">{rules}</div>
            {quiz.perCorrectGd > 0 && quiz.poolLeftGd < quiz.perCorrectGd && <p className="mt-3 rounded-xl bg-[#faf4dc] p-3 text-sm font-semibold">The per-answer G$ pool has run out. You can still play for the Top 10.</p>}
            <p className="mt-4 text-sm font-semibold text-ink/55">The clock starts as soon as each question appears. Ready?</p>
            <button className={`${primary} mt-3 w-full`} disabled={busy} onClick={() => void begin()}>{busy ? 'Starting…' : 'Start my run'}</button>
          </section>
        )
      )}

      {run && !run.finished && q && (
        <section className={card}>
          <div className="flex items-center justify-between gap-3 text-sm font-bold">
            <span>Question {q.index + 1} / {run.total}</span>
            <span className="text-forest">G$ {gd(run.earnedGd)} earned</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
            <div className={`h-full transition-[width] duration-200 ${left < 6000 ? 'bg-mandarin' : 'bg-forest'}`} style={{ width: `${(left / (quiz.questionSeconds * 1000)) * 100}%` }} />
          </div>
          <p className="mt-1 text-right text-xs font-bold text-ink/55" aria-live="polite">{Math.ceil(left / 1000)}s</p>
          {last && <Feedback result={last} perCorrect={quiz.perCorrectGd} />}
          <p className="mt-2 text-[11px] font-bold tracking-[0.14em] text-forest/60 uppercase">{q.topic}</p>
          <h2 className="mt-1 text-xl leading-snug font-bold">{q.prompt}</h2>
          <div className="mt-4 grid gap-2.5">
            {q.options.map((o, i) => (
              <button key={`${q.index}-${i}`} disabled={busy || left <= 0} onClick={() => void answer(i)} className="rounded-2xl border border-ink/12 bg-white px-4 py-3.5 text-left font-semibold hover:border-forest/40 hover:bg-[#f3f7ef] disabled:opacity-60">
                <span className="mr-2 text-forest/60">{String.fromCharCode(65 + i)}.</span>{o}
              </button>
            ))}
          </div>
        </section>
      )}

      {run && run.finished && (
        <section className={card}>
          {last && <Feedback result={last} perCorrect={quiz.perCorrectGd} />}
          <p className="text-[11px] font-bold tracking-[0.14em] text-forest/70 uppercase">Run complete</p>
          <h1 className="mt-1 text-4xl font-bold">{run.correct} <span className="text-xl text-ink/45">/ {run.total} correct</span></h1>
          <p className="mt-2 text-lg font-bold text-forest">G$ {gd(run.earnedGd)} earned</p>
          <p className="mt-1 text-sm text-ink/55">Total answer time {Math.round(run.totalMs / 100) / 10}s{run.payoutsPending ? ` · ${run.payoutsPending} payout${run.payoutsPending === 1 ? '' : 's'} still on the way` : ''}</p>
          <InviteCopy />
        </section>
      )}

      {(run?.finished || quiz.phase === 'closed' || quiz.phase === 'open') && <Leaderboard key={run?.finished ? 'done' : 'live'} prizes={quiz.top10PoolGd > 0 || quiz.top10PrizeNgn > 0} />}
      {error && <p role="alert" className="rounded-xl bg-[#fde8e2] p-3 text-sm font-semibold text-[#8a2a12]">{error}</p>}
    </Shell>
  )
}

function Feedback({ result, perCorrect }: { result: Result; perCorrect: number }) {
  const text = result.timedOut ? 'Time’s up on the last one.'
    : result.correct ? (result.payout === 'paid' ? `Correct! +G$ ${gd(result.paidGd || perCorrect)}` : result.payout === 'pool_empty' ? 'Correct! (The G$ pool has run out.)' : 'Correct! Your G$ is on the way.')
    : 'Not quite.'
  return <p role="status" className={`mb-3 rounded-xl px-3 py-2 text-sm font-bold ${result.correct ? 'bg-[#e9f3e4] text-forest' : 'bg-[#fbeee6] text-[#8a3a12]'}`}>{text}</p>
}

function Leaderboard({ prizes }: { prizes: boolean }) {
  const [board, setBoard] = useState<Board | null>(null)
  useEffect(() => {
    const get = () => request<Board>('/api/quiz/leaderboard').then(setBoard).catch(() => {})
    void get()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void get() }, 30_000)
    return () => window.clearInterval(id)
  }, [])
  if (!board) return null
  return (
    <section className="app-card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">Leaderboard</h2>
        <span className="text-xs font-semibold text-ink/50">{board.players} player{board.players === 1 ? '' : 's'} finished</span>
      </div>
      {board.you && <p className="mt-2 rounded-xl bg-[#e9f3e4] px-3 py-2 text-sm font-bold">You’re #{board.you.rank} · {board.you.correct} correct · {Math.round(board.you.totalMs / 100) / 10}s</p>}
      {board.top.length === 0 ? <p className="mt-3 text-sm text-ink/55">No finished runs yet. Be first.</p> : (
        <ol className="mt-3 grid gap-1.5">
          {board.top.map((p) => (
            <li key={p.rank} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 odd:bg-[#f7f8f2]">
              <span className="min-w-0 truncate text-sm font-semibold"><span className="mr-2 font-bold text-forest">#{p.rank}</span>{p.name} <span className="text-ink/40">{p.wallet}</span></span>
              <span className="shrink-0 text-xs font-bold text-ink/60">{p.correct} ✓ · {p.totalSeconds}s{p.prizeNgn > 0 ? ` · ₦${gd(p.prizeNgn)}` : prizes && p.bonusGd > 0 ? ` · G$ ${gd(p.bonusGd)}` : ''}</span>
            </li>
          ))}
        </ol>
      )}
      {prizes && <p className="mt-3 text-xs font-semibold text-ink/50">{board.bonusPaid ? 'Top 10 prizes have been paid.' : 'Top 10 prizes are paid in G$ after the quiz closes.'}</p>}
    </section>
  )
}

function InviteCopy() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    const text = `I just played the Jara Campus Quiz and earned G$ for every correct answer. Your turn: ${window.location.origin}/app/quiz`
    navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})
  }
  return (
    <button className="app-button-secondary mt-4 w-full justify-center" onClick={copy}>
      {copied ? 'Copied! Share it on Telegram or WhatsApp' : 'Copy an invite for your friends'}
    </button>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="jara-app min-h-dvh text-ink">
      <header className="flex min-h-20 items-center justify-between gap-3 border-b border-forest/10 bg-white px-5 py-4 sm:px-10">
        <Link href="/app" className="text-xl font-black tracking-tight">jara<span className="text-mandarin">.</span> <span className="ml-2 text-sm font-medium text-forest/70">Campus Quiz</span></Link>
        <Link href="/app" className="app-button-secondary text-xs">Back to Jara</Link>
      </header>
      <main className="mx-auto grid max-w-xl gap-5 px-4 py-8">{children}</main>
    </div>
  )
}
