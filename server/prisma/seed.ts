import bcrypt from 'bcryptjs';
import { Difficulty, PrismaClient, QuestionType, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);
  const users = [
    { email: 'admin@examshield.dev', name: 'Admin User', role: Role.ADMIN },
    { email: 'examiner@examshield.dev', name: 'Examiner User', role: Role.EXAMINER },
    { email: 'proctor@examshield.dev', name: 'Proctor User', role: Role.PROCTOR },
    { email: 'student@examshield.dev', name: 'Student User', role: Role.STUDENT },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: password },
    });
  }

  // Seed a large-ish question bank across difficulties so sets can be balanced.
  const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
  const existing = await prisma.question.count();
  if (existing === 0) {
    for (const d of difficulties) {
      for (let i = 1; i <= 40; i++) {
        await prisma.question.create({
          data: {
            text: `[${d}] Sample question ${i}: choose the correct option.`,
            type: QuestionType.MCQ,
            difficulty: d,
            subject: 'General',
            options: [
              { id: 'a', text: 'Option A' },
              { id: 'b', text: 'Option B' },
              { id: 'c', text: 'Option C' },
              { id: 'd', text: 'Option D' },
            ],
            correctKey: 'a',
          },
        });
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Login with any seeded email / password123.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
