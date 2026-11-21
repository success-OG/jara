import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/session'
import { startQuiz } from '@/lib/quiz/service'
import { quizFailure } from '@/lib/quiz/http'

export const dynamic = 'force-dynamic'

// Start (or resume) this identity's one run. Needs a connected, verified wallet and, for the
// campus launch, confirmed FlowState support for Jara. Returns the first question without its answer.
export async function POST() {
  try {
    const user = await requireUser()
    if (user instanceof NextResponse) return user
    return NextResponse.json(await startQuiz(user))
  } catch (err) { return quizFailure(err, 'quiz-start') }
}
