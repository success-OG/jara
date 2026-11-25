// Campus Quiz question bank (v1): fixed and reviewed, so every player is judged on the same
// material. Each run draws 10 at random without repeats. Option order is shuffled per player on
// the server, and the answer index never leaves the server before that question is answered.
// University-student medium: no trick questions, but every wrong option is believable and some need a
// quick sum, so scores spread out and speed decides ties. Topics: Jara, GoodDollar, money sense, campus.

export interface QuizQuestion {
  id: string
  topic: 'Jara' | 'GoodDollar' | 'Money' | 'Campus'
  prompt: string
  options: [string, string, string, string]
  /** Index into `options` of the one correct answer. */
  answer: 0 | 1 | 2 | 3
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: "jara-1", topic: "Jara", prompt: "When Jara claims your daily G$, which jar does it fill first?", options: ["Airtime", "Light", "AI", "Data"], answer: 0 },
  { id: "jara-2", topic: "Jara", prompt: "Jara’s jars are Light, Data, Airtime and…", options: ["AI", "Rent", "Transport", "Feeding"], answer: 0 },
  { id: "jara-3", topic: "Jara", prompt: "To pay electricity from your Light jar, what does Jara need?", options: ["Your meter number and electricity company", "Your BVN and bank name", "Your NIN only", "Your matric number"], answer: 0 },
  { id: "jara-4", topic: "Jara", prompt: "Which of these exams is NOT in Jara’s exam prep?", options: ["IELTS", "NABTEB", "NECO", "Post-UTME"], answer: 0 },
  { id: "jara-5", topic: "Jara", prompt: "If a bill provider declines your Jara payment, what happens to your G$?", options: ["It is refunded to the wallet that paid", "Jara keeps it as a fee", "It turns into airtime credit", "It waits until you complain"], answer: 0 },
  { id: "jara-6", topic: "Jara", prompt: "When you buy airtime in Jara, when do you see the G$ cost?", options: ["Before anything is paid", "Only after it is paid", "At the end of the month", "Only on your bank statement"], answer: 0 },
  { id: "jara-7", topic: "Jara", prompt: "The spending limit you approve for Jara can be…", options: ["Cancelled by you at any time", "Changed only by Jara", "Used to borrow in your name", "Kept forever once approved"], answer: 0 },
  { id: "jara-8", topic: "Jara", prompt: "On which blockchain do Jara’s G$ payments happen?", options: ["Celo", "Bitcoin", "Solana", "Tron"], answer: 0 },
  { id: "gd-1", topic: "GoodDollar", prompt: "What does UBI, the idea behind GoodDollar, stand for?", options: ["Universal Basic Income", "Unified Banking Interface", "Universal Bank ID", "United Budget Index"], answer: 0 },
  { id: "gd-2", topic: "GoodDollar", prompt: "A GoodDollar daily claim is tied to one…", options: ["Verified real person", "Phone number", "Email address", "Bank account"], answer: 0 },
  { id: "gd-3", topic: "GoodDollar", prompt: "Including the “0x”, how many characters is a Celo wallet address?", options: ["42", "32", "64", "40"], answer: 0 },
  { id: "gd-4", topic: "GoodDollar", prompt: "You send G$ to a wrong wallet address. What usually happens?", options: ["It cannot be reversed", "Your bank reverses it in 24 hours", "GoodDollar refunds it automatically", "It bounces back after 7 days"], answer: 0 },
  { id: "gd-5", topic: "GoodDollar", prompt: "Why must you never share your seed phrase?", options: ["Anyone with it controls your wallet", "It reveals your face scan", "It is your public address", "It expires once shared"], answer: 0 },
  { id: "gd-6", topic: "GoodDollar", prompt: "What makes a stablecoin “stable”?", options: ["Its value is pegged to an asset like the US dollar", "Its price can never change by law", "It can only be used in one country", "It is printed by a central bank"], answer: 0 },
  { id: "gd-7", topic: "GoodDollar", prompt: "“Gas” on a blockchain is…", options: ["A small fee to process a transaction", "Interest paid to wallet owners", "A bonus for new users", "A password reset code"], answer: 0 },
  { id: "money-1", topic: "Money", prompt: "You save ₦350 every day for 4 weeks. How much have you saved?", options: ["₦9,800", "₦10,500", "₦9,500", "₦1,400"], answer: 0 },
  { id: "money-2", topic: "Money", prompt: "A ₦12,500 item is 20% off. What is the new price?", options: ["₦10,000", "₦10,500", "₦12,300", "₦2,500"], answer: 0 },
  { id: "money-3", topic: "Money", prompt: "You earn ₦20,000 and spend ₦14,000. What percentage did you save?", options: ["30%", "70%", "40%", "25%"], answer: 0 },
  { id: "money-4", topic: "Money", prompt: "₦10,000 at 10% simple interest a year. How much interest after 2 years?", options: ["₦2,000", "₦2,100", "₦1,000", "₦20,000"], answer: 0 },
  { id: "money-5", topic: "Money", prompt: "Prices rise 20% in a year. Something that cost ₦1,000 last year now costs…", options: ["₦1,200", "₦1,020", "₦1,100", "₦800"], answer: 0 },
  { id: "money-6", topic: "Money", prompt: "Which data deal is cheaper per GB?", options: ["₦1,500 for 4GB", "₦1,000 for 2GB", "They cost the same per GB", "You can’t tell from this"], answer: 0 },
  { id: "money-7", topic: "Money", prompt: "Under the 50/30/20 budgeting rule, how much of a ₦50,000 allowance goes to savings?", options: ["₦10,000", "₦15,000", "₦25,000", "₦5,000"], answer: 0 },
  { id: "money-8", topic: "Money", prompt: "If 1 G$ is worth ₦0.20, how many G$ pay for ₦500 airtime?", options: ["2,500", "100", "250", "25,000"], answer: 0 },
  { id: "money-9", topic: "Money", prompt: "An emergency fund is usually advised to cover how many months of expenses?", options: ["3 to 6 months", "1 week", "1 month", "5 years"], answer: 0 },
  { id: "money-10", topic: "Money", prompt: "Someone promises to double your money in 24 hours, guaranteed. This is most likely…", options: ["A scam", "A high-risk but legal investment", "A fixed deposit", "A cooperative savings plan"], answer: 0 },
  { id: "money-11", topic: "Money", prompt: "In Nigerian banking, what does BVN stand for?", options: ["Bank Verification Number", "Bank Value Number", "Basic Verification Name", "Bank Virtual Number"], answer: 0 },
  { id: "money-12", topic: "Money", prompt: "Which body sets monetary policy in Nigeria?", options: ["Central Bank of Nigeria", "Federal Ministry of Finance", "Nigerian Stock Exchange", "Federal Inland Revenue Service"], answer: 0 },
  { id: "money-13", topic: "Money", prompt: "In what year did Nigeria change its currency from the pound to the naira?", options: ["1973", "1960", "1980", "1963"], answer: 0 },
  { id: "campus-1", topic: "Campus", prompt: "What does CGPA stand for?", options: ["Cumulative Grade Point Average", "Central Grade Pass Assessment", "Course Grade Performance Average", "Combined General Points Allowance"], answer: 0 },
  { id: "campus-2", topic: "Campus", prompt: "What does JAMB stand for?", options: ["Joint Admissions and Matriculation Board", "Joint Academic Merit Board", "Junior Admissions and Marks Bureau", "Joint Assessment of Matriculants Board"], answer: 0 },
  { id: "campus-3", topic: "Campus", prompt: "What does SIWES stand for?", options: ["Students Industrial Work Experience Scheme", "Student Internship and Work Exchange Service", "Skills and Industrial Work Evaluation Scheme", "Students In Work Education System"], answer: 0 },
  { id: "campus-4", topic: "Campus", prompt: "You score A (5 points) in a 3-unit course and C (3 points) in a 2-unit course. What is your GPA for the two?", options: ["4.2", "4.0", "4.5", "3.8"], answer: 0 },
  { id: "campus-5", topic: "Campus", prompt: "On the 5-point scale, what is the usual minimum CGPA for a First Class?", options: ["4.50", "4.00", "3.50", "4.75"], answer: 0 },
  { id: "campus-6", topic: "Campus", prompt: "Which is Nigeria’s oldest university?", options: ["University of Ibadan", "University of Lagos", "University of Nigeria, Nsukka", "Ahmadu Bello University"], answer: 0 },
  { id: "campus-7", topic: "Campus", prompt: "What does ASUU stand for?", options: ["Academic Staff Union of Universities", "Association of Students of Universities in Unity", "Academic Standards Union of Universities", "All Staff Union of Universities"], answer: 0 },
  { id: "campus-8", topic: "Campus", prompt: "Which agency issues the NIN in Nigeria?", options: ["NIMC", "INEC", "NCC", "FRSC"], answer: 0 },
  { id: "campus-9", topic: "Campus", prompt: "How many local government areas does Nigeria have?", options: ["774", "36", "500", "1,000"], answer: 0 },
  { id: "campus-10", topic: "Campus", prompt: "In what year did Abuja officially replace Lagos as Nigeria’s capital?", options: ["1991", "1976", "1999", "1960"], answer: 0 },
  { id: "campus-11", topic: "Campus", prompt: "Which of these countries is NOT a WAEC member?", options: ["Senegal", "Ghana", "Sierra Leone", "The Gambia"], answer: 0 },
  { id: "campus-12", topic: "Campus", prompt: "Presenting someone else’s work as your own, even if you change a few words, is called…", options: ["Plagiarism", "Paraphrasing", "Citation", "Peer review"], answer: 0 },
  { id: "campus-13", topic: "Campus", prompt: "An email says you won a scholarship but must pay a “processing fee” first. Best move?", options: ["Treat it as a likely scam and check the official site", "Pay fast before it expires", "Reply with your bank details to confirm", "Forward it to your class group"], answer: 0 },
]
