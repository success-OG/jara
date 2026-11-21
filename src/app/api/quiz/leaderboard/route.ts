import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/session'
import { leaderboard } from '@/lib/quiz/service'
import { quizFailure } from '@/lib/quiz/http'

export const dynamic = 'force-dynamic'

// Public Top 10 (names and shortened wallets only), plus the signed-in player's own rank.
export async function GET() {
  try { return NextResponse.json(await leaderboard(await currentUser())) }
  catch (err) { return quizFailure(err, 'quiz-leaderboard') }
}
