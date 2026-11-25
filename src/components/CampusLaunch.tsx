'use client'

import Link from 'next/link'

export type CampusState = {
  quiz: { phase: 'off' | 'soon' | 'open' | 'closed'; startAt: number | null; endAt: number | null; perCorrectGd: number; top10PrizeNgn: number; requireFlowstate: boolean }
}

const wat = (ms: number) => new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(ms) + ' WAT'

/** Campus Quiz on the dashboard while it is upcoming or live. Voting for Jara unlocks it. */
export function CampusCard({ campus, onVote }: { campus?: CampusState; onVote: () => void }) {
  if (!campus || campus.quiz.phase === 'off' || campus.quiz.phase === 'closed') return null
  const { quiz } = campus
  return (
    <section className="app-card overflow-hidden">
      <div className="bg-forest px-5 py-4 text-cream sm:px-6">
        <p className="text-[11px] font-bold tracking-[0.14em] text-crest uppercase">{quiz.phase === 'open' ? 'Live now' : quiz.startAt ? `Opens ${wat(quiz.startAt)}` : 'Coming soon'}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">Jara Campus Quiz</h2>
        <p className="mt-1 text-sm text-cream/80">10 timed questions{quiz.top10PrizeNgn > 0 ? ` · Top 10 win ₦${quiz.top10PrizeNgn.toLocaleString('en-NG')} each` : ' · Top 10 bonus'}{quiz.perCorrectGd > 0 ? ` · G$ ${quiz.perCorrectGd.toLocaleString('en-US')} per correct answer` : ''}</p>
      </div>
      <div className="grid gap-2.5 p-5 sm:px-6">
        <Link href="/app/quiz" className="app-button justify-center bg-forest text-cream hover:bg-forest-soft min-h-11 text-sm">{quiz.phase === 'open' ? 'Play the Campus Quiz →' : 'See the quiz rules →'}</Link>
        {quiz.requireFlowstate && <button onClick={onVote} className="app-button-secondary justify-center min-h-11 text-sm">Vote for Jara to unlock it</button>}
      </div>
    </section>
  )
}
