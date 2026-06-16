import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button, Card } from '../components/ui';

interface Exam {
  id: string;
  title: string;
  mode: 'ONLINE' | 'OFFLINE';
  status: string;
  examDate: string;
  _count?: { papers: number; attempts: number };
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const isStaff = user && ['ADMIN', 'EXAMINER'].includes(user.role);

  useEffect(() => {
    if (isStaff || user?.role === 'PROCTOR') {
      api.get('/exams').then((r) => setExams(r.data)).catch(() => undefined);
    }
  }, [isStaff, user]);

  async function generate(id: string) {
    await api.post(`/exams/${id}/generate`);
    const r = await api.get('/exams');
    setExams(r.data);
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

      {user?.role === 'STUDENT' && (
        <Card>
          <h2 className="font-serif text-xl font-bold">Your online exams</h2>
          <p className="mt-2 text-sm text-ink/60">
            Enter the exam ID provided by your invigilator to begin a proctored attempt.
          </p>
          <ExamEntry />
        </Card>
      )}

      {(isStaff || user?.role === 'PROCTOR') && (
        <div className="space-y-4">
          {exams.length === 0 && <Card><p className="text-ink/60">No exams yet.</p></Card>}
          {exams.map((ex) => (
            <Card key={ex.id} className="flex items-center justify-between">
              <div>
                <p className="font-serif text-lg font-bold">{ex.title}</p>
                <p className="text-sm text-ink/60">
                  {ex.mode} · {ex.status} · {new Date(ex.examDate).toLocaleString()} ·
                  {' '}{ex._count?.papers ?? 0} sets
                </p>
                <p className="mt-1 text-xs text-ink/40">ID: {ex.id}</p>
              </div>
              {isStaff && (
                <div className="flex gap-2">
                  <Button onClick={() => generate(ex.id)}>Generate now</Button>
                  {ex._count?.papers ? (
                    <a
                      className="rounded-xl border border-sakura-300 px-4 py-2.5 text-sm"
                      href={`/dashboard`}
                      onClick={(e) => { e.preventDefault(); nav('/exams/new'); }}
                    >View</a>
                  ) : null}
                </div>
              )}
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
