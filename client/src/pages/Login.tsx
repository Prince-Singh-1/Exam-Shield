import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, inputClass } from '../components/ui';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password, mode);
      nav(user.role === 'PROCTOR' ? '/proctor' : '/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Card className="w-full">
        <h1 className="font-serif text-3xl font-bold text-sakura-600">Welcome back</h1>
        <p className="mt-1 text-sm text-ink/60">Sign in to Exam Shield</p>

        <div className="mt-5 flex rounded-xl bg-sakura-50 p-1">
          {(['ONLINE', 'OFFLINE'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === m ? 'bg-white text-sakura-600 shadow' : 'text-ink/50'
              }`}
            >
              {m === 'ONLINE' ? '🟢 Online' : '📄 Offline'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/50">
          Note: students can only sign in for online exams. Offline exams are physical.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Email">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p className="text-sm text-sakura-600">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
        </form>

        <div className="mt-5 rounded-xl bg-sakura-50/60 p-3 text-xs text-ink/60">
          <p className="font-medium">Demo accounts (password: <code>password123</code>)</p>
          <p>admin@ · examiner@ · proctor@ · student@ — examshield.dev</p>
        </div>
      </Card>
    </div>
  );
}
