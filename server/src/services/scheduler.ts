import cron from 'node-cron';
import { ExamMode, ExamStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { generateExamPapers } from './examService';

/**
 * Runs every minute. For OFFLINE exams whose generateAt time (examDate - leadTime)
 * has passed and which haven't been generated yet, it generates the balanced papers.
 * This enforces the "generate N hours before exam" anti-leak requirement.
 */
export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const due = await prisma.exam.findMany({
      where: {
        mode: ExamMode.OFFLINE,
        status: ExamStatus.SCHEDULED,
        generateAt: { lte: now },
      },
      include: { createdBy: true },
    });
    for (const exam of due) {
      try {
        await generateExamPapers(exam.id, exam.createdById);
        // eslint-disable-next-line no-console
        console.log(`[scheduler] Generated papers for exam ${exam.id} (${exam.title}).`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[scheduler] Failed to generate exam ${exam.id}:`, (e as Error).message);
      }
    }
  });
  // eslint-disable-next-line no-console
  console.log('[scheduler] Offline paper-generation scheduler started.');
}
