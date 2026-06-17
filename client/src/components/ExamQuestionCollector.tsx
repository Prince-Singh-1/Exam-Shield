import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Button, inputClass } from './ui';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface Props {
  mode: 'ONLINE' | 'OFFLINE';
  numberOfSets: number;
  easyPerSet: number;
  mediumPerSet: number;
  hardPerSet: number;
}

interface QuestionDraft {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctKey: 'a' | 'b' | 'c' | 'd';
}

type Drafts = Record<Difficulty, QuestionDraft[]>;
type Counts = Record<Difficulty, number>;

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: 'EASY', label: 'Easy' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'HARD', label: 'Hard' },
];

const EMPTY_COUNTS: Counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
const EMPTY_DRAFTS: Drafts = { EASY: [], MEDIUM: [], HARD: [] };

function blankQuestion(): QuestionDraft {
  return { text: '', optionA: '', optionB: '', optionC: '', optionD: '', correctKey: 'a' };
}

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function ExamQuestionCollector({
  mode,
  numberOfSets,
  easyPerSet,
  mediumPerSet,
  hardPerSet,
}: Props) {
  const [drafts, setDrafts] = useState<Drafts>(EMPTY_DRAFTS);
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [subject, setSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const requirements = useMemo<Counts>(() => {
    const multiplier = mode === 'OFFLINE' ? safeCount(numberOfSets) || 1 : 1;
    return {
      EASY: safeCount(easyPerSet) * multiplier,
      MEDIUM: safeCount(mediumPerSet) * multiplier,
      HARD: safeCount(hardPerSet) * multiplier,
    };
  }, [mode, numberOfSets, easyPerSet, mediumPerSet, hardPerSet]);

  const totalRequired = requirements.EASY + requirements.MEDIUM + requirements.HARD;

  async function loadCounts() {
    const { data } = await api.get('/questions');
    const nextCounts: Counts = { ...EMPTY_COUNTS };
    (data.counts ?? []).forEach((item: { difficulty: Difficulty; _count: number }) => {
      nextCounts[item.difficulty] = item._count;
    });
    setCounts(nextCounts);
  }

  useEffect(() => {
    loadCounts().catch(() => undefined);
  }, []);

  useEffect(() => {
    setDrafts((current) => {
      let changed = false;
      const next: Drafts = { EASY: current.EASY, MEDIUM: current.MEDIUM, HARD: current.HARD };

      DIFFICULTIES.forEach(({ key }) => {
        const target = requirements[key];
        const rows = current[key] ?? [];
        if (rows.length < target) {
          next[key] = [...rows, ...Array.from({ length: target - rows.length }, blankQuestion)];
          changed = true;
        } else if (rows.length > target) {
          next[key] = rows.slice(0, target);
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [requirements.EASY, requirements.MEDIUM, requirements.HARD]);

  function updateDraft(difficulty: Difficulty, index: number, patch: Partial<QuestionDraft>) {
    setDrafts((current) => ({
      ...current,
      [difficulty]: current[difficulty].map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    }));
  }

  async function saveQuestions() {
    setError('');
    setMessage('');

    const questions: Array<{
      text: string;
      type: 'MCQ';
      difficulty: Difficulty;
      subject?: string;
      options: { id: string; text: string }[];
      correctKey: string;
    }> = [];
    const problems: string[] = [];

    DIFFICULTIES.forEach(({ key, label }) => {
      drafts[key].forEach((draft, index) => {
        const row = `${label} question ${index + 1}`;
        const options = [
          { id: 'a', text: draft.optionA.trim() },
          { id: 'b', text: draft.optionB.trim() },
          { id: 'c', text: draft.optionC.trim() },
          { id: 'd', text: draft.optionD.trim() },
        ].filter((option) => option.text);

        if (!draft.text.trim()) problems.push(`${row} needs question text`);
        if (options.length < 2) problems.push(`${row} needs at least two options`);
        if (!options.some((option) => option.id === draft.correctKey)) {
          problems.push(`${row} correct option is blank`);
        }

        questions.push({
          text: draft.text.trim(),
          type: 'MCQ',
          difficulty: key,
          subject: subject.trim() || undefined,
          options,
          correctKey: draft.correctKey,
        });
      });
    });

    if (totalRequired === 0) {
      setError('Set the question counts before adding paper questions.');
      return;
    }
    if (problems.length > 0) {
      setError(problems.slice(0, 4).join('. '));
      return;
    }

    setSaving(true);
    try {
      await api.post('/questions/bulk', { questions });
      setMessage(`Saved ${questions.length} questions to the bank.`);
      setDrafts({
        EASY: Array.from({ length: requirements.EASY }, blankQuestion),
        MEDIUM: Array.from({ length: requirements.MEDIUM }, blankQuestion),
        HARD: Array.from({ length: requirements.HARD }, blankQuestion),
      });
      await loadCounts();
    } catch (err: any) {
      setError(err?.response?.data?.error ? JSON.stringify(err.response.data.error) : 'Could not save questions');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-sakura-300 bg-white/80 p-5 shadow-glass">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-sakura-600">Enter questions by difficulty rating</h2>
          <p className="mt-1 text-xs text-ink/50">
            Based on your paper settings, add {requirements.EASY} easy, {requirements.MEDIUM} medium, and {requirements.HARD} hard questions.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-ink/60">
          {DIFFICULTIES.map(({ key, label }) => (
            <div key={key} className="rounded-lg bg-sakura-50 px-3 py-2">
              <div className="font-semibold text-ink">{counts[key]}</div>
              <div>{label} saved</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/70">Subject for these questions</span>
          <input
            className={inputClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="mt-4 space-y-4">
        {DIFFICULTIES.map(({ key, label }) => (
          <section key={key} className="rounded-xl border border-sakura-100 bg-white/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-sakura-600">{label} questions</h3>
              <span className="rounded-full bg-sakura-50 px-3 py-1 text-xs font-semibold text-ink/60">
                {requirements[key]} required
              </span>
            </div>
            {drafts[key].length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">No {label.toLowerCase()} questions requested.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {drafts[key].map((draft, index) => (
                  <div key={`${key}-${index}`} className="rounded-xl bg-sakura-50/60 p-4">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-ink/60">
                        {label} question {index + 1}
                      </span>
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={draft.text}
                        onChange={(e) => updateDraft(key, index, { text: e.target.value })}
                      />
                    </label>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {(['a', 'b', 'c', 'd'] as const).map((optionKey) => (
                        <label key={optionKey} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`${key}-${index}-correct`}
                            checked={draft.correctKey === optionKey}
                            onChange={() => updateDraft(key, index, { correctKey: optionKey })}
                          />
                          <input
                            className={inputClass}
                            value={
                              optionKey === 'a' ? draft.optionA :
                              optionKey === 'b' ? draft.optionB :
                              optionKey === 'c' ? draft.optionC :
                              draft.optionD
                            }
                            onChange={(e) =>
                              updateDraft(key, index, {
                                [optionKey === 'a' ? 'optionA' : optionKey === 'b' ? 'optionB' : optionKey === 'c' ? 'optionC' : 'optionD']:
                                  e.target.value,
                              })
                            }
                            placeholder={`Option ${optionKey.toUpperCase()}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-sakura-600">{error}</p>}
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      <div className="mt-4">
        <Button type="button" onClick={saveQuestions} disabled={saving || totalRequired === 0}>
          {saving ? 'Saving questions...' : `Save ${totalRequired} paper questions`}
        </Button>
      </div>
    </div>
  );
}
