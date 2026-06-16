import { ExamStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { generateBalancedSets } from './setGenerator';

/**
 * Generates balanced, randomized papers for an exam and persists them with an
 * anti-leak audit stamp (exam date, generated-at, generated-by).
 * Idempotent-ish: skips if papers already exist.
 */
export async function generateExamPapers(examId: string, generatedById: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { papers: true } });
  if (!exam) throw new Error('Exam not found');
  if (exam.papers.length > 0) {
    return { skipped: true, reason: 'Papers already generated', sets: exam.papers.length };
  }

  const bank = await prisma.question.findMany({ select: { id: true, difficulty: true } });
  const sets = generateBalancedSets(bank, {
    numberOfSets: exam.numberOfSets,
    easyPerSet: exam.easyPerSet,
    mediumPerSet: exam.mediumPerSet,
    hardPerSet: exam.hardPerSet,
  });

  await prisma.$transaction(async (tx) => {
    for (const set of sets) {
      await tx.generatedPaper.create({
        data: {
          examId: exam.id,
          setLabel: set.setLabel,
          totalWeight: set.totalWeight,
          examDate: exam.examDate,
          generatedById,
          items: {
            create: set.questionIds.map((questionId, order) => ({ questionId, order })),
          },
        },
      });
    }
    await tx.exam.update({ where: { id: exam.id }, data: { status: ExamStatus.GENERATED } });
  });

  return { skipped: false, sets: sets.length, balanced: sets.every((s) => s.totalWeight === sets[0].totalWeight) };
}
