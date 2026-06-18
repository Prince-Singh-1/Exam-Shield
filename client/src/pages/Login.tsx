import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, inputClass } from '../components/ui';

export function Login() {
  const { login, verifyOtp } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [mode, setMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (otpStep) {
        const user = await verifyOtp(email, otp, mode);
        nav(user.role === 'PROCTOR' ? '/proctor' : '/dashboard');
      } else {
        const res = await login(email, password, mode);
        if ('requiresVerification' in res) {
          setOtpStep(true);
        } else {
          nav(res.role === 'PROCTOR' ? '/proctor' : '/dashboard');
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? (otpStep ? 'Verification failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Card className="w-full">
        <Link to="/" className="mb-4 inline-block text-sm text-ink/60 underline">Back to home</Link>
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
              {m === 'ONLINE' ? 'Online' : 'Offline'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/50">
          Students can only sign in for online exams. Offline exams are physical.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {!otpStep ? (
            <>
              <Field label="Email">
                <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <Field label="Password">
                <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
            </>
          ) : (
            <Field label="One-Time Password">
              <p className="mb-2 text-xs text-ink/60">An OTP was sent to your email. Please enter it below to verify your account.</p>
              <input className={inputClass} type="text" placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6} />
            </Field>
          )}
          {error && <p className="text-sm text-sakura-600">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? 'Please wait...' : otpStep ? 'Verify OTP' : 'Sign in'}</Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink/60">
          New to Exam Shield? <Link to="/signup" className="font-medium text-sakura-600 underline">Create an account</Link>
        </p>
      </Card>
    </div>
  );
}
