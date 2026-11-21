import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { apiFailure } from '../api-error'
import { serverConfig } from '../env'
import { QuizError } from './service'

/** Say what happened in JSON; unknown failures never claim a payout failed. */
export function quizFailure(err: unknown, context: string) {
  if (err instanceof QuizError) {
    return NextResponse.json({ error: err.message, code: err.code, retryable: err.status >= 500 || err.status === 429 }, { status: err.status })
  }
  if (err instanceof Error && /Connect your GoodDollar account first|wallet link has changed/.test(err.message)) {
    return NextResponse.json({ error: err.message, code: 'not_connected' }, { status: 409 })
  }
  return apiFailure(err, context)
}

export function cronAuthorized(req: Request): boolean {
  const secret = serverConfig().cronSecret
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return Boolean(secret) && got.length === want.length && timingSafeEqual(got, want)
}
