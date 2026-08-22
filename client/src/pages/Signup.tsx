import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../lib/api';
import { Button, Card, Field, inputClass } from '../components/ui';

const ROLES: { value: Role; label: string; desc: string; icon: string }[] = [
  { value: 'ADMIN', label: 'Administrator', desc: 'Full platform control', icon: '🛡️' },
  { value: 'EXAMINER', label: 'Examiner / Instructor', desc: 'Create exams & question banks', icon: '✍️' },
  { value: 'PROCTOR', label: 'Invigilator / Proctor', desc: 'Monitor live exams', icon: '👁️' },
  { value: 'STUDENT', label: 'Student', desc: 'Take online proctored exams', icon: '🎓' },
];

export function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('EXAMINER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register({ name, email, password, role });
      nav(user.role === 'PROCTOR' ? '/proctor' : '/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error ? JSON.stringify(err.response.data.error) : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  function signUpWithGoogle() {
    const base = import.meta.env.VITE_API_URL || '/api';
    window.location.href = `${base}/auth/google/start?role=${encodeURIComponent(role)}`;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <Card className="w-full">
        <h1 className="font-serif text-3xl font-bold text-sakura-600">Create account</h1>
        <p className="mt-1 text-sm text-ink/60">Join Exam Shield</p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Full name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          <div>
            <span className="mb-2 block text-sm font-medium text-ink/70">I am signing up as</span>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`rounded-xl border p-3 text-left transition ${
                    role === r.value ? 'border-sakura-400 bg-sakura-50 shadow' : 'border-sakura-100 bg-white/70'
                  }`}
                >
                  <div className="text-xl">{r.icon}</div>
                  <div className="mt-1 text-sm font-semibold text-ink">{r.label}</div>
                  <div className="text-xs text-ink/50">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-sakura-600">{error}</p>}
          <Button className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <div className="mt-4">
          <button
            type="button"
            onClick={signUpWithGoogle}
            className="w-full rounded-xl border border-sakura-200 bg-white/80 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white"
          >
            Continue with Google
          </button>
          <p className="mt-2 text-xs text-ink/45">Google sign-in will create an account with the selected role.</p>
        </div>

        <p className="mt-5 text-center text-sm text-ink/60">
          Already have an account? <Link to="/login" className="font-medium text-sakura-600 underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
