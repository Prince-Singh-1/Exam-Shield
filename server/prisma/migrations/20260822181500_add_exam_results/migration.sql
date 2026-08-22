CREATE TABLE "ExamResult" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "setLabel" TEXT,
  "studentDetails" JSONB,
  "submittedAnswers" JSONB NOT NULL,
  "answerKey" JSONB NOT NULL,
  "mcqScore" INTEGER NOT NULL DEFAULT 0,
  "totalMcq" INTEGER NOT NULL DEFAULT 0,
  "subjectiveScore" INTEGER NOT NULL DEFAULT 0,
  "totalSubjective" INTEGER NOT NULL DEFAULT 0,
  "totalScore" INTEGER NOT NULL DEFAULT 0,
  "maxScore" INTEGER NOT NULL DEFAULT 0,
  "answeredCount" INTEGER NOT NULL DEFAULT 0,
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamResult_attemptId_key" ON "ExamResult"("attemptId");
CREATE INDEX "ExamResult_examId_idx" ON "ExamResult"("examId");
CREATE INDEX "ExamResult_studentId_idx" ON "ExamResult"("studentId");

ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
