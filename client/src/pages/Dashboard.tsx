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

interface StudentAttempt {
  id: string;
  examId: string;
  examTitle: string;
  mode: 'ONLINE' | 'OFFLINE';
  setLabel: string | null;
  score: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: string;
}

interface StaffAttempt {
  id: string;
  student: { id: string; name: string; email: string };
  setLabel: string | null;
  score: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: string;
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [studentAttempts, setStudentAttempts] = useState<StudentAttempt[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [staffAttempts, setStaffAttempts] = useState<StaffAttempt[]>([]);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const isStaff = user && ['ADMIN', 'EXAMINER'].includes(user.role);

  async function loadExams() {
    const r = await api.get('/exams');
    setExams(r.data);
    if (!selectedExamId && r.data[0]?.id) setSelectedExamId(r.data[0].id);
  }

  async function loadStudentAttempts() {
    const r = await api.get('/attempts/me');
    setStudentAttempts(r.data);
  }

  async function loadStaffAttempts(examId: string) {
    if (!examId) return;
    const r = await api.get(`/attempts/exam/${examId}`);
    setStaffAttempts(r.data);
  }

  useEffect(() => {
    if (isStaff || user?.role === 'PROCTOR') {
      loadExams().catch(() => setMessage('Could not load exams.'));
    }
  }, [isStaff, user]);

  useEffect(() => {
    if (user?.role === 'STUDENT') {
      loadStudentAttempts().catch(() => setMessage('Could not load your results.'));
    }
  }, [user]);

  useEffect(() => {
    if (isStaff && selectedExamId) {
      loadStaffAttempts(selectedExamId).catch(() => setMessage('Could not load exam performance.'));
    }
  }, [isStaff, selectedExamId]);

  async function generate(id: string) {
    setMessage('');
    setBusyId(id);
    try {
      const { data } = await api.post(`/exams/${id}/generate`);
      await loadExams();
      setMessage(data.skipped ? data.reason : `Generated ${data.sets} balanced paper set${data.sets === 1 ? '' : 's'}.`);
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'Could not generate papers. Check question-bank counts.');
    } finally {
      setBusyId('');
    }
  }

  async function deleteExam(id: string) {
    if (!confirm('Delete this exam and all generated papers?')) return;
    setBusyId(id);
    setMessage('');
    try {
      await api.delete(`/exams/${id}`);
      await loadExams();
      if (selectedExamId === id && exams[0]?.id) setSelectedExamId(exams[0].id);
      setMessage('Exam deleted.');
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'Could not delete exam.');
    } finally {
      setBusyId('');
    }
  }

  async function downloadPdf(exam: Exam, paper: Paper, answerKey = false) {
    setMessage('');
    setBusyId(exam.id);
    try {
      const path = answerKey ? 'answer-key-pdf' : 'pdf';
      const { data } = await api.get(`/exams/${exam.id}/papers/${paper.id}/${path}`, { responseType: 'blob' });
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = exam.title.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'exam';
      const safeSet = paper.setLabel.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'set';
      a.href = url;
      a.download = answerKey ? `${safeTitle}-${safeSet}-answer-key.pdf` : `${safeTitle}-${safeSet}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'Could not download PDF.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-sakura-600">Exam Shield</h1>
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
        <div className="space-y-6">
          <Card>
            <h2 className="font-serif text-xl font-bold">Your online exams</h2>
            <p className="mt-2 text-sm text-ink/60">
              Enter the exam ID provided by your invigilator to begin a proctored attempt.
            </p>
            <ExamEntry />
          </Card>

          <Card>
            <h2 className="font-serif text-xl font-bold">Your performance</h2>
            <p className="mt-2 text-sm text-ink/60">Recent submitted attempts are stored here automatically.</p>
            <div className="mt-4 space-y-3">
              {studentAttempts.length === 0 ? (
                <p className="text-sm text-ink/50">No submitted attempts yet.</p>
              ) : (
                studentAttempts.map((attempt) => (
                  <div key={attempt.id} className="rounded-xl border border-sakura-100 bg-white/70 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-ink">{attempt.examTitle}</p>
                        <p className="text-xs text-ink/50">
                          {attempt.mode} · {attempt.setLabel ?? 'Set'} · {new Date(attempt.submittedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-sakura-600">
                          {attempt.score}/{attempt.totalQuestions}
                        </p>
                        <p className="text-sm text-ink/60">{attempt.percentage}%</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {isStaff && (
        <div className="mb-6">
          <QuestionBank />
        </div>
      )}

      {(isStaff || user?.role === 'PROCTOR') && (
        <div className="space-y-6">
          <div>
            <h2 className="font-serif text-2xl font-bold text-sakura-600">Exams</h2>
            {exams.length === 0 && <Card><p className="text-ink/60">No exams yet.</p></Card>}
            <div className="mt-4 space-y-4">
              {exams.map((ex) => (
                <Card key={ex.id}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-serif text-lg font-bold">{ex.title}</p>
                      <p className="text-sm text-ink/60">
                        {ex.mode} · {ex.status} · {new Date(ex.examDate).toLocaleString()} · {ex._count?.papers ?? 0} sets
                      </p>
                      <p className="mt-1 text-xs text-ink/40">ID: {ex.id}</p>
                    </div>
                    {isStaff && (
                      <div className="flex flex-wrap gap-2">
                        {ex.mode === 'OFFLINE' && (
                          <Button onClick={() => generate(ex.id)} disabled={busyId === ex.id}>
                            {busyId === ex.id ? 'Working...' : 'Generate now'}
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteExam(ex.id)}
                          disabled={busyId === ex.id}
                          className="rounded-xl border border-sakura-200 bg-white/70 px-4 py-2 text-sm font-medium text-sakura-600 disabled:opacity-50"
                        >
                          Delete exam
                        </button>
                      </div>
                    )}
                  </div>

                  {isStaff && ex.papers?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-sakura-100 pt-4">
                      {ex.papers.map((paper) => (
                        <div key={paper.id} className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => downloadPdf(ex, paper, false)}
                            disabled={busyId === ex.id}
                            className="rounded-xl border border-sakura-300 bg-white/70 px-4 py-2 text-sm font-medium text-sakura-600 transition hover:bg-white disabled:opacity-50"
                          >
                            {paper.setLabel} PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPdf(ex, paper, true)}
                            disabled={busyId === ex.id}
                            className="rounded-xl border border-ink/15 bg-white/70 px-4 py-2 text-sm font-medium text-ink transition hover:bg-white disabled:opacity-50"
                          >
                            Answer key
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          </div>

          {isStaff && (
            <Card>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-serif text-xl font-bold">Student performance dashboard</h2>
                  <p className="mt-1 text-sm text-ink/60">See submitted attempts for each exam.</p>
                </div>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="rounded-xl border border-sakura-200 bg-white/80 px-3 py-2 text-sm"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.title}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 space-y-3">
                {staffAttempts.length === 0 ? (
                  <p className="text-sm text-ink/50">No submitted attempts for this exam yet.</p>
                ) : (
                  staffAttempts.map((attempt) => (
                    <div key={attempt.id} className="rounded-xl border border-sakura-100 bg-white/70 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-ink">{attempt.student.name}</p>
                          <p className="text-xs text-ink/50">{attempt.student.email} · {attempt.setLabel ?? 'Set'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-sakura-600">
                            {attempt.score}/{attempt.totalQuestions}
                          </p>
                          <p className="text-sm text-ink/60">{attempt.percentage}% · {new Date(attempt.submittedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
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
