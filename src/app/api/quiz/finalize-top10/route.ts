import { NextResponse } from 'next/server'
import { finalizeTop10 } from '@/lib/quiz/service'
import { cronAuthorized, quizFailure } from '@/lib/quiz/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// After the window closes: freeze the Top 10 and pay each bonus once. Safe to run again.
// Header: Authorization: Bearer $CRON_SECRET
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json(await finalizeTop10()) }
  catch (err) { return quizFailure(err, 'quiz-finalize') }
}
