import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useExamLockdown } from '../hooks/useExamLockdown';
import { useProctoring } from '../hooks/useProctoring';
import { Button, Card } from '../components/ui';

interface Question {
  id: string;
  text: string;
  type: 'MCQ' | 'SUBJECTIVE';
  options?: { id: string; text: string }[] | null;
}

type Phase = 'instructions' | 'running' | 'submitted';
type SaveSignal = 'complete' | 'partial' | 'unresolved' | 'blocked';

const saveSignalText: Record<SaveSignal, string> = {
  complete: 'Saved (COMPLETE)',
  partial: 'Saving... (PARTIAL)',
  unresolved: 'Offline (UNRESOLVED)',
  blocked: 'Blocked (BLOCKED)',
};

const saveSignalClass: Record<SaveSignal, string> = {
  complete: 'border-green-200 bg-green-50 text-green-800',
  partial: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  unresolved: 'border-orange-200 bg-orange-50 text-orange-800',
  blocked: 'border-red-200 bg-red-50 text-red-800',
};

export function OnlineExam() {
  const { examId } = useParams();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>('instructions');
  const [attemptId, setAttemptId] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [studentDetails, setStudentDetails] = useState({ name: '', rollNumber: '', section: '', institution: '' });
  const [setLabel, setSetLabel] = useState('');
  const [instructions, setInstructions] = useState<string>('');
  const [duration, setDuration] = useState(60);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [totalMcq, setTotalMcq] = useState(0);
  const [subjectiveScore, setSubjectiveScore] = useState(0);
  const [totalSubjective, setTotalSubjective] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSignal, setSaveSignal] = useState<SaveSignal>('partial');
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [error, setError] = useState('');
  const attemptRef = useRef('');
  const answersRef = useRef<Record<string, string>>({});
  const studentDetailsRef = useRef(studentDetails);

  const running = phase === 'running';

  // Report a violation (optionally with a captured snapshot) to the server.
  const report = useCallback(async (type: string, detail?: string, capture?: Blob | null) => {
    setViolations((n) => n + 1);
    if (!attemptRef.current) return;
    const fd = new FormData();
    fd.append('attemptId', attemptRef.current);
    fd.append('type', type);
    if (detail) fd.append('detail', detail);
    if (capture) fd.append('capture', capture, 'capture.png');
    api.post('/violations', fd).catch(() => undefined);
  }, []);

  useExamLockdown(running, (type, detail) => report(type, detail));
  const { videoRef, canvasRef, status, aiStatus, errorMessage: mediaError } = useProctoring(running, report);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    studentDetailsRef.current = studentDetails;
  }, [studentDetails]);

  useEffect(() => {
    if (running && (mediaError || violations >= 5)) {
      setSaveSignal('blocked');
    }
  }, [mediaError, running, violations]);

  // Timer
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(t); submit(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  async function begin() {
    setError('');
    if (!studentDetails.name.trim() || !studentDetails.rollNumber.trim()) {
      setError('Enter your name and roll number before starting.');
      return;
    }
    try {
      // Paper is assembled NOW — questions were secret until this moment.
      const { data } = await api.post(`/attempts/${examId}/start`);
      const loadedQuestions = data.questions ?? [];
      if (!loadedQuestions.length) {
        setError('No questions are available for this exam. Ask the examiner to add questions to the bank.');
        return;
      }
      setAttemptId(data.attemptId);
      attemptRef.current = data.attemptId;
      setQuestions(loadedQuestions);
      setAnswers(data.answers ?? {});
      setSetLabel(data.setLabel ?? 'Online Set 1');
      setInstructions(data.instructions ?? '');
      setDuration(data.durationMinutes);
      setSecondsLeft(data.durationMinutes * 60);
      if (data.studentDetails) setStudentDetails((current) => ({ ...current, ...data.studentDetails }));
      await api.patch(`/attempts/${data.attemptId}/save`, { answers: data.answers ?? {}, studentDetails });
      setSaveSignal('complete');
      setLastSavedAt(new Date().toISOString());
      setPhase('running');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not start exam');
    }
  }

  useEffect(() => {
    if (!running || !attemptRef.current) return;
    if (saveSignal !== 'blocked') setSaveSignal('partial');
    setSaving(true);
    const t = window.setTimeout(async () => {
      try {
        await api.patch(`/attempts/${attemptRef.current}/save`, {
          answers: answersRef.current,
          studentDetails: studentDetailsRef.current,
        });
        if (!mediaError && violations < 5) setSaveSignal('complete');
        setLastSavedAt(new Date().toISOString());
      } catch {
        if (saveSignal !== 'blocked') setSaveSignal('unresolved');
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(t);
  }, [answers, running]);

  async function submit() {
    if (submitting || !attemptRef.current) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/attempts/${attemptRef.current}/submit`, { answers, studentDetails });
      setScore(data.score);
      setTotalMcq(data.totalMcq ?? 0);
      setSubjectiveScore(data.subjectiveScore ?? 0);
      setTotalSubjective(data.totalSubjective ?? 0);
      setAnsweredCount(data.answeredCount ?? Object.keys(answers).length);
      document.exitFullscreen?.().catch(() => undefined);
      setPhase('submitted');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not submit the exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'instructions') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Card>
          <h1 className="font-serif text-2xl font-bold text-sakura-600">Exam instructions</h1>
          <div className="mt-4 space-y-2 text-sm text-ink/80">
            <p>This is a <b>proctored, locked-down</b> exam. By starting you agree that:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your webcam and microphone will be used for AI proctoring.</li>
              <li>Copy/paste, right-click, DevTools, printing and tab-switching are disabled and logged.</li>
              <li>Phone, multiple-face, looking-away and voice detection capture timestamped evidence.</li>
              <li>The exam runs in fullscreen. Leaving fullscreen is recorded as a violation.</li>
            </ul>
            <div className="mt-3 rounded-lg bg-sakura-50 p-3 whitespace-pre-line">
              {instructions || 'Read all questions carefully. Attempt all questions. For MCQs, select the single best option.'}
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">Full name</span>
              <input
                className="w-full rounded-xl border border-sakura-200 bg-white/80 px-4 py-2.5 outline-none"
                value={studentDetails.name}
                onChange={(e) => setStudentDetails((current) => ({ ...current, name: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">Roll number</span>
              <input
                className="w-full rounded-xl border border-sakura-200 bg-white/80 px-4 py-2.5 outline-none"
                value={studentDetails.rollNumber}
                onChange={(e) => setStudentDetails((current) => ({ ...current, rollNumber: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">Section</span>
              <input
                className="w-full rounded-xl border border-sakura-200 bg-white/80 px-4 py-2.5 outline-none"
                value={studentDetails.section}
                onChange={(e) => setStudentDetails((current) => ({ ...current, section: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">Institution</span>
              <input
                className="w-full rounded-xl border border-sakura-200 bg-white/80 px-4 py-2.5 outline-none"
                value={studentDetails.institution}
                onChange={(e) => setStudentDetails((current) => ({ ...current, institution: e.target.value }))}
              />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-sakura-600">{error}</p>}
          <div className="mt-5 flex gap-3">
            <Button onClick={begin}>I understand — start exam</Button>
            <button onClick={() => nav('/dashboard')} className="text-sm text-ink/60 underline">Cancel</button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'submitted') {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Card className="text-center">
          <div className="text-4xl">🌸</div>
          <h1 className="mt-3 font-serif text-2xl font-bold text-sakura-600">Exam submitted</h1>
          {score !== null && (
            <p className="mt-2 text-lg text-ink/70">
              Auto-graded MCQ score: <b>{score} / {totalMcq}</b>
            </p>
          )}
          {totalSubjective > 0 && (
            <p className="mt-1 text-sm text-ink/60">
              Subjective checker estimate: <b>{subjectiveScore} / {totalSubjective}</b>
            </p>
          )}
          <p className="mt-1 text-sm text-ink/60">{answeredCount} answers submitted.</p>
          <p className="mt-2 text-sm text-ink/60">{violations} proctoring events were recorded.</p>
          <Button className="mt-5" onClick={() => nav('/dashboard')}>Back to dashboard</Button>
        </Card>
      </div>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="exam-locked mx-auto max-w-4xl px-6 py-6">
      {/* Proctoring HUD */}
      <div className="sticky top-0 z-20 mb-4 flex items-center justify-between rounded-2xl glass px-4 py-3">
        <div className="flex items-center gap-3">
          <video ref={videoRef} muted playsInline className="h-14 w-20 rounded-lg bg-black object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="text-xs">
            <p className="font-medium">AI Proctor: <span className={status === 'running' ? 'text-green-600' : 'text-sakura-600'}>{status}</span></p>
            <p className="text-ink/50">
              {status === 'running' ? 'Camera and microphone active' : 'Waiting for camera and microphone'}
            </p>
            <p className="text-ink/50">AI detection: {aiStatus} - {violations} events</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="text-xs font-semibold text-ink/60">{setLabel}</div>
          <div className="font-mono text-lg font-bold text-sakura-600">⏱ {mm}:{ss}</div>
        </div>
      </div>

      <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${saveSignalClass[saveSignal]}`}>
        {saveSignalText[saveSignal]}
        {lastSavedAt && saveSignal === 'complete' ? (
          <span className="ml-2 font-normal">Last saved {new Date(lastSavedAt).toLocaleTimeString()}</span>
        ) : null}
        {saving && saveSignal === 'partial' ? <span className="ml-2 font-normal">Syncing answers</span> : null}
      </div>

      {(mediaError || error) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mediaError || error}
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, i) => (
          <Card key={q.id}>
            <p className="font-medium"><span className="text-sakura-600">Q{i + 1}.</span> {q.text}</p>
            {q.type === 'MCQ' && q.options ? (
              <div className="mt-3 space-y-2">
                {q.options.map((opt, idx) => (
                  <label key={opt.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition ${answers[q.id] === opt.id ? 'border-sakura-400 bg-sakura-50' : 'border-sakura-100'}`}>
                    <input type="radio" name={q.id} checked={answers[q.id] === opt.id} onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))} />
                    <span>({String.fromCharCode(65 + idx)}) {opt.text}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="mt-3 w-full rounded-xl border border-sakura-100 px-4 py-2.5"
                rows={3}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              />
            )}
          </Card>
        ))}
      </div>

      <div className="sticky bottom-0 mt-4 flex justify-end rounded-2xl glass px-4 py-3">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit exam'}
        </Button>
      </div>
    </div>
  );
}
