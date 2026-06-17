import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button, Card } from '../components/ui';
import { QuestionBank } from '../components/QuestionBank';

interface Paper {
  id: string;
  setLabel: string;
  totalWeight: number;
  generatedAt: string;
}

interface Exam {
  id: string;
  title: string;
  mode: 'ONLINE' | 'OFFLINE';
  status: string;
  examDate: string;
  papers?: Paper[];
  _count?: { papers: number; attempts: number };
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [busyExamId, setBusyExamId] = useState('');
  const [message, setMessage] = useState('');
  const isStaff = user && ['ADMIN', 'EXAMINER'].includes(user.role);

  async function loadExams() {
    const r = await api.get('/exams');
    setExams(r.data);
  }

  useEffect(() => {
    if (isStaff || user?.role === 'PROCTOR') {
      loadExams().catch(() => setMessage('Could not load exams.'));
    }
  }, [isStaff, user]);

  async function generate(id: string) {
    setMessage('');
    setBusyExamId(id);
    try {
      const { data } = await api.post(`/exams/${id}/generate`);
      await loadExams();
      setMessage(
        data.skipped
          ? data.reason
          : `Generated ${data.sets} balanced paper set${data.sets === 1 ? '' : 's'}.`,
      );
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'Could not generate papers. Check question-bank counts.');
    } finally {
      setBusyExamId('');
    }
  }

  async function downloadPdf(exam: Exam, paper: Paper) {
    setMessage('');
    setBusyExamId(exam.id);
    try {
      const { data } = await api.get(`/exams/${exam.id}/papers/${paper.id}/pdf`, { responseType: 'blob' });
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = exam.title.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'exam';
      const safeSet = paper.setLabel.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'set';
      a.href = url;
      a.download = `${safeTitle}-${safeSet}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'Could not download PDF.');
    } finally {
      setBusyExamId('');
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-sakura-600">🛡️ Exam Shield</h1>
          <p className="text-sm text-ink/60">Signed in as {user?.name} · {user?.role}</p>
        </div>
        <div className="flex gap-3">
          {isStaff && <Link to="/exams/new"><Button>+ New exam</Button></Link>}
          <button onClick={() => { logout(); nav('/'); }} className="text-sm text-ink/60 underline">Sign out</button>
        </div>
      </header>

      {message && (
        <div className="mb-4 rounded-xl border border-sakura-100 bg-white/70 px-4 py-3 text-sm text-ink/70 shadow-glass">
          {message}
        </div>
      )}

      {user?.role === 'STUDENT' && (
        <Card>
          <h2 className="font-serif text-xl font-bold">Your online exams</h2>
          <p className="mt-2 text-sm text-ink/60">
            Enter the exam ID provided by your invigilator to begin a proctored attempt.
          </p>
          <ExamEntry />
        </Card>
      )}

      {isStaff && (
        <div className="mb-6">
          <QuestionBank />
        </div>
      )}

      {(isStaff || user?.role === 'PROCTOR') && (
        <div className="space-y-4">
          <h2 className="font-serif text-2xl font-bold text-sakura-600">Exams</h2>
          {exams.length === 0 && <Card><p className="text-ink/60">No exams yet.</p></Card>}
          {exams.map((ex) => (
            <Card key={ex.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-serif text-lg font-bold">{ex.title}</p>
                <p className="text-sm text-ink/60">
                  {ex.mode} · {ex.status} · {new Date(ex.examDate).toLocaleString()} ·
                  {' '}{ex._count?.papers ?? 0} sets
                </p>
                <p className="mt-1 text-xs text-ink/40">ID: {ex.id}</p>
              </div>
              {isStaff && (
                <div className="flex flex-wrap gap-2">
                  {ex.mode === 'OFFLINE' && (
                    <Button onClick={() => generate(ex.id)} disabled={busyExamId === ex.id}>
                      {busyExamId === ex.id ? 'Working...' : 'Generate now'}
                    </Button>
                  )}
                </div>
              )}
              </div>
              {isStaff && ex.papers?.length ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-sakura-100 pt-4">
                  {ex.papers.map((paper) => (
                    <button
                      key={paper.id}
                      type="button"
                      onClick={() => downloadPdf(ex, paper)}
                      disabled={busyExamId === ex.id}
                      className="rounded-xl border border-sakura-300 bg-white/70 px-4 py-2 text-sm font-medium text-sakura-600 transition hover:bg-white disabled:opacity-50"
                    >
                      Download {paper.setLabel} PDF
                    </button>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ExamEntry() {
  const nav = useNavigate();
  const [id, setId] = useState('');
  return (
    <div className="mt-4 flex gap-3">
      <input
        className="flex-1 rounded-xl border border-sakura-200 bg-white/80 px-4 py-2.5 outline-none"
        placeholder="Exam ID"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <Button onClick={() => id && nav(`/exam/${id}`)}>Start exam</Button>
    </div>
  );
}
