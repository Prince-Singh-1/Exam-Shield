import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function GoogleAuth() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const userRaw = params.get('user');
    if (!token || !userRaw) {
      nav('/login', { replace: true });
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw));
      localStorage.setItem('es_token', token);
      localStorage.setItem('es_user', JSON.stringify(user));
      nav(user.role === 'PROCTOR' ? '/proctor' : '/dashboard', { replace: true });
    } catch {
      nav('/login', { replace: true });
    }
  }, [nav, params]);

  return <div className="mx-auto max-w-md px-6 py-20 text-center text-ink/60">Signing you in with Google...</div>;
}
