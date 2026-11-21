// Campus Quiz question bank (v1): fixed and reviewed, so every player is judged on the same
// material. Each run draws 10 at random without repeats. Option order is shuffled per player on
// the server, and the answer index never leaves the server before that question is answered.
// University-student medium: what Jara and GoodDollar do, everyday money sense, campus general.

export interface QuizQuestion {
  id: string
  topic: 'Jara' | 'GoodDollar' | 'Money' | 'Campus'
  prompt: string
  options: [string, string, string, string]
  /** Index into `options` of the one correct answer. */
  answer: 0 | 1 | 2 | 3
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: 'jara-1', topic: 'Jara', prompt: 'What does Jara do with the G$ you claim every day?', options: ['Splits it into budgets for bills like light, data and airtime', 'Sells it for naira at the end of every day', 'Locks it away for one year', 'Sends it to a random user'], answer: 0 },
  { id: 'jara-2', topic: 'Jara', prompt: 'In Jara, what is a “jar”?', options: ['A budget that saves G$ for one purpose, like data or light', 'A type of crypto wallet password', 'A group chat for students', 'A loan you repay monthly'], answer: 0 },
  { id: 'jara-3', topic: 'Jara', prompt: 'Which of these can your G$ pay for inside Jara AI?', options: ['Exam practice, CVs and assignment help', 'Flight tickets', 'School fees only', 'Nothing, Jara AI is only for chatting'], answer: 0 },
  { id: 'jara-4', topic: 'Jara', prompt: 'Which exams does Jara’s exam prep cover?', options: ['WAEC, JAMB, NECO and Post-UTME', 'Only IELTS', 'Only driving tests', 'Only SAT'], answer: 0 },
  { id: 'jara-5', topic: 'Jara', prompt: 'How can you sign in to Jara without a seed phrase?', options: ['With Google or email', 'By sending Jara your bank PIN', 'By mailing a photo of your ID', 'You cannot; a seed phrase is required'], answer: 0 },
  { id: 'jara-6', topic: 'Jara', prompt: 'Why does Jara warn you before your GoodDollar face verification expires?', options: ['So your daily G$ claims don’t quietly stop', 'To charge you a renewal fee', 'Because your account will be deleted', 'To change your password'], answer: 0 },
  { id: 'jara-7', topic: 'Jara', prompt: 'What do you approve so Jara can pay bills and AI help for you?', options: ['A spending limit you can cancel any time', 'Full access to your bank account', 'Your phone’s screen lock', 'A loan agreement'], answer: 0 },
  { id: 'gd-1', topic: 'GoodDollar', prompt: 'What is GoodDollar (G$)?', options: ['A digital currency that gives verified people free G$ daily', 'A Nigerian bank', 'A betting app', 'A government bond'], answer: 0 },
  { id: 'gd-2', topic: 'GoodDollar', prompt: 'Why does GoodDollar ask for a one-time face check?', options: ['So each real person claims only once', 'To post your photo publicly', 'To check your age for a club', 'To create a profile picture'], answer: 0 },
  { id: 'gd-3', topic: 'GoodDollar', prompt: 'How often can a verified GoodDollar member claim G$?', options: ['Once a day', 'Once a year', 'Only on their birthday', 'Every minute'], answer: 0 },
  { id: 'gd-4', topic: 'GoodDollar', prompt: 'Which blockchain does Jara use for G$?', options: ['Celo', 'Bitcoin', 'Dogecoin', 'None, it is just a spreadsheet'], answer: 0 },
  { id: 'gd-5', topic: 'GoodDollar', prompt: 'What is “gas” on a blockchain like Celo?', options: ['A small network fee for a transaction', 'Petrol for generators', 'A type of stablecoin bonus', 'A password reset code'], answer: 0 },
  { id: 'gd-6', topic: 'GoodDollar', prompt: 'Which of these should you NEVER share with anyone, including support staff?', options: ['Your wallet seed phrase or private key', 'Your public wallet address', 'Your Jara referral link', 'Your favourite course'], answer: 0 },
  { id: 'gd-7', topic: 'GoodDollar', prompt: 'A “wallet address” on Celo usually starts with…', options: ['0x', 'NG', 'www', '@'], answer: 0 },
  { id: 'money-1', topic: 'Money', prompt: 'What is a budget?', options: ['A plan for how you will spend and save money', 'A type of bank loan', 'Money you owe the government', 'A shopping coupon'], answer: 0 },
  { id: 'money-2', topic: 'Money', prompt: 'You save ₦500 every day for 30 days. How much have you saved?', options: ['₦15,000', '₦1,500', '₦5,000', '₦150,000'], answer: 0 },
  { id: 'money-3', topic: 'Money', prompt: 'What does “inflation” mean?', options: ['Prices generally rising, so money buys less', 'Prices generally falling', 'A bank paying you interest', 'A rise in your salary'], answer: 0 },
  { id: 'money-4', topic: 'Money', prompt: 'An item costs ₦8,000 and is 25% off. What is the new price?', options: ['₦6,000', '₦7,750', '₦2,000', '₦6,500'], answer: 0 },
  { id: 'money-5', topic: 'Money', prompt: 'What is an emergency fund?', options: ['Savings kept aside for unexpected costs', 'Money borrowed for a party', 'A government grant for businesses', 'A fee banks charge at night'], answer: 0 },
  { id: 'money-6', topic: 'Money', prompt: 'Someone promises to double your money in 24 hours, guaranteed. This is most likely…', options: ['A scam', 'A savings account', 'A scholarship', 'A normal investment'], answer: 0 },
  { id: 'money-7', topic: 'Money', prompt: 'What is “interest” on a loan?', options: ['The extra cost you pay for borrowing money', 'A discount for paying early', 'Free money from the bank', 'The name of the lender'], answer: 0 },
  { id: 'money-8', topic: 'Money', prompt: 'You earn ₦20,000 and spend ₦14,000. What percentage did you save?', options: ['30%', '14%', '60%', '6%'], answer: 0 },
  { id: 'money-9', topic: 'Money', prompt: 'Which is a “need” rather than a “want”?', options: ['Data for your online classes', 'A third pair of sneakers', 'A new phone case', 'Concert tickets'], answer: 0 },
  { id: 'campus-1', topic: 'Campus', prompt: 'What does CGPA stand for?', options: ['Cumulative Grade Point Average', 'Central Grade Pass Assessment', 'Course Grade Performance Award', 'Combined General Points Allowance'], answer: 0 },
  { id: 'campus-2', topic: 'Campus', prompt: 'What does JAMB stand for?', options: ['Joint Admissions and Matriculation Board', 'Joint Academic Merit Board', 'Junior Admissions and Marks Bureau', 'Joint Assessment of Matriculants Board'], answer: 0 },
  { id: 'campus-3', topic: 'Campus', prompt: 'What does NYSC stand for?', options: ['National Youth Service Corps', 'Nigerian Youth Skills Council', 'National Young Students Club', 'New Youth Service Commission'], answer: 0 },
  { id: 'campus-4', topic: 'Campus', prompt: 'Copying someone else’s work and presenting it as yours is called…', options: ['Plagiarism', 'Citation', 'Paraphrasing with credit', 'Peer review'], answer: 0 },
  { id: 'campus-5', topic: 'Campus', prompt: 'What does SIWES give students?', options: ['Industrial work experience during their course', 'A free laptop', 'Exemption from exams', 'A foreign scholarship'], answer: 0 },
  { id: 'campus-6', topic: 'Campus', prompt: 'A course worth 3 credit units with grade point 5 contributes how many quality points?', options: ['15', '8', '5', '3'], answer: 0 },
  { id: 'campus-7', topic: 'Campus', prompt: 'You get an email saying you won a scholarship, but must pay a “processing fee” first. Best move?', options: ['Treat it as a likely scam and check the official site', 'Pay quickly before it expires', 'Share your bank PIN to confirm', 'Forward it to all your friends'], answer: 0 },
]
