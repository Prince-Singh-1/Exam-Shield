import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_ORIGIN } from '../lib/api';
import { Card } from '../components/ui';

interface Violation {
  id: string;
  type: string;
  detail?: string;
  capturePath?: string;
  createdAt: string;
  student: { name: string; email: string };
}

const LABEL: Record<string, string> = {
  TAB_SWITCH: '🔄 Tab switch', FULLSCREEN_EXIT: '⛶ Left fullscreen', WINDOW_BLUR: '👁️ Lost focus',
  COPY_PASTE: '📋 Copy/paste', DEVTOOLS: '🛠️ DevTools', GAZE_AWAY: '👀 Gaze away',
  PHONE_DETECTED: '📱 Phone detected', MULTIPLE_FACES: '👥 Multiple faces',
  NO_FACE: '😶 No face', VOICE_DETECTED: '🗣️ Voice detected',
};

export function ProctorDashboard() {
  const [violations, setViolations] = useState<Violation[]>([]);

  useEffect(() => {
    const load = () => api.get('/violations').then((r) => setViolations(r.data)).catch(() => undefined);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold text-sakura-600">👁️ Proctor dashboard</h1>
        <Link to="/dashboard" className="text-sm text-ink/60 underline">Dashboard</Link>
      </header>
      <p className="mb-4 text-sm text-ink/60">Live cheating-event feed (auto-refreshes). {violations.length} events.</p>

      <div className="grid gap-4 md:grid-cols-2">
        {violations.map((v) => (
          <Card key={v.id} className="flex gap-4">
            {v.capturePath ? (
              <img src={`${API_ORIGIN}/${v.capturePath}`} alt="capture" className="h-24 w-32 rounded-lg object-cover" />
            ) : (
              <div className="flex h-24 w-32 items-center justify-center rounded-lg bg-sakura-50 text-2xl">⚠️</div>
            )}
            <div>
              <p className="font-medium">{LABEL[v.type] ?? v.type}</p>
              <p className="text-sm text-ink/70">{v.student?.name} · {v.student?.email}</p>
              {v.detail && <p className="text-xs text-ink/50">{v.detail}</p>}
              <p className="mt-1 text-xs text-ink/40">{new Date(v.createdAt).toLocaleString()}</p>
            </div>
          </Card>
        ))}
        {violations.length === 0 && <Card><p className="text-ink/60">No violations recorded yet.</p></Card>}
      </div>
    </div>
  );
}
