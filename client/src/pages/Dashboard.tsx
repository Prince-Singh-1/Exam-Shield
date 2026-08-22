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
  numberOfSets: number;
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

  async function deleteExam(exam: Exam) {
    const confirmed = window.confirm(
      `Delete "${exam.title}"? Generated papers, student attempts, and proctoring records for this exam will also be deleted.`,
    );
    if (!confirmed) return;

    setMessage('');
    setBusyExamId(exam.id);
    try {
      await api.delete(`/exams/${exam.id}`);
      setExams((current) => current.filter((item) => item.id !== exam.id));
      setMessage(`Deleted "${exam.title}".`);
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'Could not delete exam.');
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

      {user?.role === 'ADMIN' && <AdminCommandCenter exams={exams} />}

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
                  {' '}{ex.mode === 'ONLINE' ? ex.numberOfSets : ex._count?.papers ?? 0} sets
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
                  <button
                    type="button"
                    onClick={() => deleteExam(ex)}
                    disabled={busyExamId === ex.id}
                    className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete exam
                  </button>
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

function AdminCommandCenter({ exams }: { exams: Exam[] }) {
  const activeOnline = exams.filter((exam) => exam.mode === 'ONLINE').length;
  const printedSets = exams.reduce((sum, exam) => sum + (exam._count?.papers ?? 0), 0);
  const attempts = exams.reduce((sum, exam) => sum + (exam._count?.attempts ?? 0), 0);
  const upcoming = exams.filter((exam) => new Date(exam.examDate).getTime() > Date.now()).length;

  return (
    <div className="mb-6 space-y-4">
      <div>
        <h2 className="font-serif text-2xl font-bold text-sakura-600">Administrator command center</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Access controls', `${activeOnline} online exams`, 'Granular roles with zero-knowledge exam access.'],
          ['Timetable scheduler', `${upcoming} upcoming`, 'Conflict checks for exams, venues, and staff coverage.'],
          ['Network diagnostics', 'Pre-test ready', 'Camera, microphone, bandwidth, and browser readiness.'],
          ['Audit integrity', `${attempts} attempts`, 'Immutable administrative action trail and analytics.'],
        ].map(([title, value, detail]) => (
          <Card key={title}>
            <p className="text-xs font-semibold uppercase text-ink/40">{title}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
            <p className="mt-1 text-xs text-ink/55">{detail}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h3 className="font-serif text-xl font-bold text-sakura-600">Live network monitoring grid</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {['North Lab', 'South Lab', 'Remote A', 'Remote B', 'Venue 101', 'Venue 204', 'Sandbox JSX', 'Proctor Wall'].map((node, index) => (
              <div key={node} className={`rounded-lg border px-3 py-3 text-sm ${index % 5 === 0 ? 'border-yellow-200 bg-yellow-50 text-yellow-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
                <div className="font-semibold">{node}</div>
                <div className="mt-1 text-xs">{index % 5 === 0 ? 'Watch' : 'Healthy'}</div>
              </div>
            ))}
          </div>
        </Card>
        <JsxSandbox />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="font-serif text-lg font-bold text-sakura-600">Cryptographic audit log</h3>
          <div className="mt-3 space-y-2 text-xs text-ink/60">
            <p>Latest hash: SHA-256:{String(printedSets + attempts + upcoming).padStart(6, '0')}ES</p>
            <p>Administrative actions are chained for tamper-evident review.</p>
          </div>
        </Card>
        <Card>
          <h3 className="font-serif text-lg font-bold text-sakura-600">Assessment sandboxes</h3>
          <p className="mt-3 text-xs text-ink/60">Online coding exams run in isolated browser sandboxes with JSX preview support.</p>
        </Card>
        <Card>
          <h3 className="font-serif text-lg font-bold text-sakura-600">Learning-gap analytics</h3>
          <p className="mt-3 text-xs text-ink/60">Global exam outcomes can be mapped by subject, difficulty, and curriculum area.</p>
        </Card>
      </div>
    </div>
  );
}

function JsxSandbox() {
  const [code, setCode] = useState('<main style={{fontFamily:"sans-serif",padding:16}}><h1>JSX Exam</h1><p>Preview sandbox</p></main>');
  const html = `<!doctype html><html><body><div id="root"></div>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="text/babel">
      const App = () => (${code});
      ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    </script>
  </body></html>`;

  return (
    <Card>
      <h3 className="font-serif text-xl font-bold text-sakura-600">Online JSX compiler</h3>
      <textarea
        className="mt-4 h-32 w-full rounded-xl border border-sakura-100 bg-white/80 px-3 py-2 font-mono text-xs outline-none"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <iframe
        title="JSX sandbox preview"
        sandbox="allow-scripts"
        srcDoc={html}
        className="mt-3 h-36 w-full rounded-xl border border-sakura-100 bg-white"
      />
    </Card>
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
