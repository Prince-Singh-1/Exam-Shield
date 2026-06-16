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

export function OnlineExam() {
  const { examId } = useParams();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>('instructions');
  const [attemptId, setAttemptId] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState<string>('');
  const [duration, setDuration] = useState(60);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState('');
  const attemptRef = useRef('');

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
  const { videoRef, canvasRef, status } = useProctoring(running, report);

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
    try {
      // Paper is assembled NOW — questions were secret until this moment.
      const { data } = await api.post(`/attempts/${examId}/start`);
      setAttemptId(data.attemptId);
      attemptRef.current = data.attemptId;
      setQuestions(data.questions);
      setInstructions(data.instructions ?? '');
      setDuration(data.durationMinutes);
      setSecondsLeft(data.durationMinutes * 60);
      setPhase('running');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not start exam');
    }
  }

  async function submit() {
    try {
      const { data } = await api.post(`/attempts/${attemptRef.current}/submit`, { answers });
      setScore(data.score);
    } catch { /* ignore */ }
    document.exitFullscreen?.().catch(() => undefined);
    setPhase('submitted');
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
          {score !== null && <p className="mt-2 text-ink/70">Auto-graded MCQ score: <b>{score}</b></p>}
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
            <p className="text-ink/50">{violations} events</p>
          </div>
        </div>
        <div className="font-mono text-lg font-bold text-sakura-600">⏱ {mm}:{ss}</div>
      </div>

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
        <Button onClick={submit}>Submit exam</Button>
      </div>
    </div>
  );
}
