import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Button, Card, Field, inputClass } from './ui';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type QuestionType = 'MCQ' | 'SUBJECTIVE';

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  difficulty: Difficulty;
  options?: Option[] | null;
  correctKey?: string | null;
  subject?: string | null;
}

type Counts = Record<Difficulty, number>;

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const EMPTY_COUNTS: Counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
const DEFAULT_OPTIONS: Option[] = [
  { id: 'a', text: '' },
  { id: 'b', text: '' },
  { id: 'c', text: '' },
  { id: 'd', text: '' },
];

export function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [text, setText] = useState('');
  const [type, setType] = useState<QuestionType>('MCQ');
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [subject, setSubject] = useState('');
  const [options, setOptions] = useState<Option[]>(DEFAULT_OPTIONS);
  const [correctKey, setCorrectKey] = useState('a');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const total = useMemo(() => DIFFICULTIES.reduce((sum, key) => sum + counts[key], 0), [counts]);

  async function loadQuestions() {
    const { data } = await api.get('/questions');
    setQuestions(data.questions ?? []);
    const nextCounts: Counts = { ...EMPTY_COUNTS };
    (data.counts ?? []).forEach((item: { difficulty: Difficulty; _count: number }) => {
      nextCounts[item.difficulty] = item._count;
    });
    setCounts(nextCounts);
  }

  useEffect(() => {
    loadQuestions().catch(() => setError('Could not load question bank'));
  }, []);

  function updateOption(id: string, value: string) {
    setOptions((current) => current.map((option) => (option.id === id ? { ...option, text: value } : option)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    const cleanOptions = options.map((option) => ({ ...option, text: option.text.trim() })).filter((option) => option.text);
    if (type === 'MCQ' && cleanOptions.length < 2) {
      setError('Add at least two options for an MCQ question.');
      return;
    }
    if (type === 'MCQ' && !cleanOptions.some((option) => option.id === correctKey)) {
      setError('Select a correct option that has option text.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/questions', {
        text: text.trim(),
        type,
        difficulty,
        subject: subject.trim() || undefined,
        options: type === 'MCQ' ? cleanOptions : undefined,
        correctKey: type === 'MCQ' ? correctKey : undefined,
      });
      setText('');
      setSubject('');
      setOptions(DEFAULT_OPTIONS);
      setCorrectKey('a');
      setDifficulty('EASY');
      setType('MCQ');
      setMessage('Question added to the bank.');
      await loadQuestions();
    } catch (err: any) {
      setError(err?.response?.data?.error ? JSON.stringify(err.response.data.error) : 'Could not save question');
    } finally {
      setLoading(false);
    }
  }

  async function removeQuestion(id: string) {
    setError('');
    setMessage('');
    try {
      await api.delete(`/questions/${id}`);
      setMessage('Question removed.');
      await loadQuestions();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not delete question');
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-serif text-xl font-bold text-sakura-600">Question bank</h2>
          <p className="mt-1 text-sm text-ink/60">
            {total} questions available: {counts.EASY} easy, {counts.MEDIUM} medium, {counts.HARD} hard.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-ink/60">
          {DIFFICULTIES.map((key) => (
            <div key={key} className="rounded-lg border border-sakura-100 bg-white/70 px-3 py-2">
              <div className="font-semibold text-ink">{counts[key]}</div>
              <div>{key.toLowerCase()}</div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Question text">
          <textarea
            className={inputClass}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Type">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
              <option value="MCQ">MCQ</option>
              <option value="SUBJECTIVE">Subjective</option>
            </select>
          </Field>
          <Field label="Difficulty">
            <select className={inputClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {DIFFICULTIES.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Optional" />
          </Field>
        </div>

        {type === 'MCQ' && (
          <div className="rounded-xl bg-sakura-50/60 p-4">
            <p className="mb-3 text-sm font-medium text-ink/70">Options</p>
            <div className="space-y-2">
              {options.map((option, index) => (
                <label key={option.id} className="grid gap-2 md:grid-cols-[auto_1fr] md:items-center">
                  <span className="flex items-center gap-2 text-sm text-ink/70">
                    <input
                      type="radio"
                      name="correctKey"
                      checked={correctKey === option.id}
                      onChange={() => setCorrectKey(option.id)}
                    />
                    {String.fromCharCode(65 + index)}
                  </span>
                  <input
                    className={inputClass}
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-sakura-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Add question'}</Button>
      </form>

      <div className="mt-6 border-t border-sakura-100 pt-5">
        <h3 className="text-sm font-semibold text-ink/70">Saved questions</h3>
        <div className="mt-3 space-y-3">
          {questions.length === 0 && <p className="text-sm text-ink/50">No questions have been added yet.</p>}
          {questions.slice(0, 12).map((question) => (
            <div key={question.id} className="rounded-xl border border-sakura-100 bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{question.text}</p>
                  <p className="mt-1 text-xs text-ink/50">
                    {question.type} | {question.difficulty}{question.subject ? ` | ${question.subject}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="text-xs font-medium text-sakura-600 underline"
                >
                  Delete
                </button>
              </div>
              {question.type === 'MCQ' && question.options?.length ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {question.options.map((option, index) => (
                    <div
                      key={option.id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        question.correctKey === option.id ? 'bg-green-50 text-green-800' : 'bg-sakura-50/70 text-ink/70'
                      }`}
                    >
                      {String.fromCharCode(65 + index)}. {option.text}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
