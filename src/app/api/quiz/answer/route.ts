import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/session'
import { answerQuestion } from '@/lib/quiz/service'
import { quizFailure } from '@/lib/quiz/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// { runId, index, choice }: scored against the server deadline; a correct answer pays G$ once.
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    if (user instanceof NextResponse) return user
    const body = (await req.json().catch(() => ({}))) as { runId?: unknown; index?: unknown; choice?: unknown }
    return NextResponse.json(await answerQuestion(user, body))
  } catch (err) { return quizFailure(err, 'quiz-answer') }
}
