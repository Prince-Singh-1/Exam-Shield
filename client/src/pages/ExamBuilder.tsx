import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button, Card, Field, inputClass } from '../components/ui';
import { ExamQuestionCollector } from '../components/ExamQuestionCollector';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type Counts = Record<Difficulty, number>;

const EMPTY_COUNTS: Counts = { EASY: 0, MEDIUM: 0, HARD: 0 };

export function ExamBuilder() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    title: '',
    mode: 'OFFLINE' as 'ONLINE' | 'OFFLINE',
    examDate: '',
    leadTimeHours: 12,
    numberOfSets: 4,
    questionsPerSet: 20,
    easyPerSet: 10,
    mediumPerSet: 6,
    hardPerSet: 4,
    durationMinutes: 90,
    instructions:
      'Read all questions carefully.\nAttempt all questions.\nFor MCQs, select the single best option.\nNo electronic devices are permitted.',
  });
  const [error, setError] = useState('');
  const [created, setCreated] = useState<any>(null);
  const [bankCounts, setBankCounts] = useState<Counts>(EMPTY_COUNTS);

  const perSet = form.easyPerSet + form.mediumPerSet + form.hardPerSet;
  const weight = form.easyPerSet * 1 + form.mediumPerSet * 2 + form.hardPerSet * 3;
  const requiredMultiplier = form.mode === 'OFFLINE' ? form.numberOfSets : 1;
  const requiredCounts: Counts = {
    EASY: form.easyPerSet * requiredMultiplier,
    MEDIUM: form.mediumPerSet * requiredMultiplier,
    HARD: form.hardPerSet * requiredMultiplier,
  };
  const shortfalls = (Object.keys(requiredCounts) as Difficulty[]).filter(
    (difficulty) => bankCounts[difficulty] < requiredCounts[difficulty],
  );
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const num = (k: string) => (e: any) => set(k, Number(e.target.value));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (perSet <= 0) {
      setError('Each exam needs at least one question per set.');
      return;
    }
    if (perSet !== form.questionsPerSet) {
      setError('Easy, medium, and hard counts must add up to the questions per set value.');
      return;
    }
    if (shortfalls.length > 0) {
      setError(
        shortfalls
          .map((difficulty) => `Need ${requiredCounts[difficulty]} ${difficulty} questions, have ${bankCounts[difficulty]}.`)
          .join(' '),
      );
      return;
    }
    try {
      const { data } = await api.post('/exams', {
        ...form,
        examDate: new Date(form.examDate).toISOString(),
      });
      setCreated(data);
    } catch (err: any) {
      setError(err?.response?.data?.error ? JSON.stringify(err.response.data.error) : 'Failed');
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <Card>
          <h1 className="font-serif text-2xl font-bold text-sakura-600">Exam created ✅</h1>
          <p className="mt-2 text-ink/70">"{created.title}" ({created.mode}) is ready.</p>
          {created.mode === 'OFFLINE' && created.generateAt && (
            <p className="mt-2 text-sm text-ink/60">
              Papers will auto-generate at {new Date(created.generateAt).toLocaleString()}
              {' '}({form.leadTimeHours}h before the exam).
            </p>
          )}
          <p className="mt-3 rounded-lg bg-sakura-50 p-3 text-xs">Exam ID: <b>{created.id}</b></p>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => nav('/dashboard')}>Back to dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <Card>
        <h1 className="font-serif text-2xl font-bold text-sakura-600">Create exam</h1>
        <p className="mt-2 text-sm text-ink/60">
          Tell Exam Shield how many questions each set should contain, split them by difficulty,
          then enter the actual questions below.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Title">
            <input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>

          <div className="flex rounded-xl bg-sakura-50 p-1">
            {(['OFFLINE', 'ONLINE'] as const).map((m) => (
              <button key={m} type="button" onClick={() => set('mode', m)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${form.mode === m ? 'bg-white text-sakura-600 shadow' : 'text-ink/50'}`}>
                {m === 'OFFLINE' ? '📄 Offline (printed)' : '🟢 Online (proctored)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Exam date & time">
              <input className={inputClass} type="datetime-local" value={form.examDate} onChange={(e) => set('examDate', e.target.value)} required />
            </Field>
            {form.mode === 'OFFLINE' && (
              <Field label="Generate paper (hours before)">
                <input className={inputClass} type="number" min={0} value={form.leadTimeHours} onChange={num('leadTimeHours')} />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Number of sets">
              <input className={inputClass} type="number" min={1} value={form.numberOfSets} onChange={num('numberOfSets')} />
            </Field>
            <Field label="Duration (minutes)">
              <input className={inputClass} type="number" min={1} value={form.durationMinutes} onChange={num('durationMinutes')} />
            </Field>
          </div>

          <div className="rounded-xl bg-sakura-50/60 p-4">
            <p className="mb-3 text-sm font-medium text-ink/70">Questions per set</p>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Total questions per set">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={form.questionsPerSet}
                  onChange={num('questionsPerSet')}
                />
              </Field>
              <Field label="Easy"><input className={inputClass} type="number" min={0} value={form.easyPerSet} onChange={num('easyPerSet')} /></Field>
              <Field label="Medium"><input className={inputClass} type="number" min={0} value={form.mediumPerSet} onChange={num('mediumPerSet')} /></Field>
              <Field label="Hard"><input className={inputClass} type="number" min={0} value={form.hardPerSet} onChange={num('hardPerSet')} /></Field>
            </div>
            <div className="mt-3 flex flex-col gap-1 text-xs text-ink/60">
              <p>
                Current split: <b>{perSet}</b> / {form.questionsPerSet} questions per set.
              </p>
              <p>
                Difficulty weight per set: <b>{weight}</b>.
              </p>
              {perSet !== form.questionsPerSet && (
                <p className="text-sakura-600">
                  The easy, medium, and hard counts need to add up exactly to the total questions per set.
                </p>
              )}
            </div>
          </div>

          <ExamQuestionCollector
            mode={form.mode}
            numberOfSets={form.numberOfSets}
            easyPerSet={form.easyPerSet}
            mediumPerSet={form.mediumPerSet}
            hardPerSet={form.hardPerSet}
            onCountsChange={setBankCounts}
          />

          <div className="rounded-xl border border-sakura-100 bg-white/70 p-4">
            <p className="text-sm font-semibold text-ink/70">Question bank readiness</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((difficulty) => {
                const ready = bankCounts[difficulty] >= requiredCounts[difficulty];
                return (
                  <div
                    key={difficulty}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      ready ? 'bg-green-50 text-green-800' : 'bg-sakura-50 text-sakura-600'
                    }`}
                  >
                    {difficulty}: {bankCounts[difficulty]} saved / {requiredCounts[difficulty]} needed
                  </div>
                );
              })}
            </div>
            {shortfalls.length > 0 && (
              <p className="mt-3 text-xs text-sakura-600">
                Save enough questions in each difficulty before creating the exam.
              </p>
            )}
          </div>

          <Field label="Instructions (printed/shown before exam)">
            <textarea className={inputClass} rows={4} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} />
          </Field>

          {error && <p className="text-sm text-sakura-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={perSet !== form.questionsPerSet || shortfalls.length > 0}>
              Create exam
            </Button>
            <button type="button" onClick={() => nav('/dashboard')} className="text-sm text-ink/60 underline">Cancel</button>
          </div>
        </form>
      </Card>
    </div>
  );
}
