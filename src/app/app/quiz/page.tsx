import type { Metadata } from 'next'
import { CampusQuiz } from '@/components/CampusQuiz'

export const metadata: Metadata = { title: 'Campus Quiz — Jara' }

export default function QuizPage() {
  return <CampusQuiz />
}
