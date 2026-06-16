import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui';

const features = [
  { icon: '🔒', title: 'Anti-cheat lockdown', desc: 'Copy/paste, right-click, DevTools and tab-switching are blocked and logged in real time.' },
  { icon: '👁️', title: 'AI proctoring', desc: 'Eye/gaze, mobile phone, multi-face and voice detection with automatic evidence capture.' },
  { icon: '⚖️', title: 'Balanced sets', desc: 'Randomized question papers with identical difficulty across every set.' },
  { icon: '🕐', title: 'Anti-leak generation', desc: 'Papers auto-generate a configurable number of hours before the exam, fully audit-stamped.' },
];

export function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <nav className="mb-16 flex items-center justify-between">
        <span className="font-serif text-2xl font-bold text-sakura-600">🛡️ Exam Shield</span>
        <Link to="/login"><Button>Sign in</Button></Link>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h1 className="font-serif text-5xl font-bold leading-tight text-ink md:text-6xl">
          Reimagining the future of <span className="text-sakura-600">examinations</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink/70">
          Secure, fair, and intelligent. Exam Shield protects integrity for both online
          AI-proctored exams and offline printed papers — wrapped in a calm, beautiful experience.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/login"><Button className="px-8 py-3 text-lg">Get started</Button></Link>
        </div>
      </motion.div>

      <div className="mt-20 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="glass rounded-2xl p-6"
          >
            <div className="text-3xl">{f.icon}</div>
            <h3 className="mt-3 font-serif text-lg font-bold text-ink">{f.title}</h3>
            <p className="mt-2 text-sm text-ink/70">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-20 grid gap-6 md:grid-cols-2">
        <div className="glass rounded-2xl p-8">
          <h2 className="font-serif text-2xl font-bold text-sakura-600">🟢 Online exams</h2>
          <p className="mt-3 text-ink/70">
            Papers are assembled the instant a student begins, so questions stay secret. A full
            browser lockdown plus live AI proctoring keeps every attempt fair.
          </p>
        </div>
        <div className="glass rounded-2xl p-8">
          <h2 className="font-serif text-2xl font-bold text-sakura-600">📄 Offline exams</h2>
          <p className="mt-3 text-ink/70">
            Upload a huge question bank, choose your set configuration, and Exam Shield generates
            balanced, printable PDF papers — timed to release just before the exam.
          </p>
        </div>
      </div>
    </div>
  );
}
