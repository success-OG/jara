import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/session'
import { quizHome } from '@/lib/quiz/service'
import { quizFailure } from '@/lib/quiz/http'

export const dynamic = 'force-dynamic'

// The quiz screen: window, gate and the player's run (database reads only).
export async function GET() {
  try { return NextResponse.json(await quizHome(await currentUser())) }
  catch (err) { return quizFailure(err, 'quiz') }
}
