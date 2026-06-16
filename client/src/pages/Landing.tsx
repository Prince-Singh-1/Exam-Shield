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
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-16 flex items-center justify-between"
      >
        <motion.span
          whileHover={{ scale: 1.06 }}
          className="font-serif text-2xl font-bold text-sakura-600"
        >
          🛡️ Exam Shield
        </motion.span>
        <Link to="/login"><Button>Sign in</Button></Link>
      </motion.nav>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="mx-auto mb-6 w-fit rounded-full border border-sakura-200 bg-white/60 px-4 py-1.5 text-sm font-medium text-sakura-600 shadow-glass"
        >
          🌸 Secure · Fair · Intelligent
        </motion.div>
        <h1 className="font-serif text-5xl font-bold leading-tight text-ink md:text-6xl">
          Reimagining the future of <span className="shimmer">examinations</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink/70">
          Secure, fair, and intelligent. Exam Shield protects integrity for both online
          AI-proctored exams and offline printed papers — wrapped in a calm, beautiful experience.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/login"><Button className="px-8 py-3 text-lg">Get started →</Button></Link>
          <Link to="/signup">
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-xl border border-sakura-300 bg-white/60 px-8 py-3 text-lg font-medium text-sakura-600 shadow-glass transition hover:bg-white"
            >
              Create account
            </motion.button>
          </Link>
        </div>
      </motion.div>

      <div className="mt-20 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 * i, duration: 0.5 }}
            whileHover={{ y: -8 }}
            className="glass glass-hover group rounded-2xl p-6"
          >
            <motion.div
              whileHover={{ scale: 1.25, rotate: 8 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="w-fit text-3xl"
            >
              {f.icon}
            </motion.div>
            <h3 className="mt-3 font-serif text-lg font-bold text-ink group-hover:text-sakura-600">{f.title}</h3>
            <p className="mt-2 text-sm text-ink/70">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-20 grid gap-6 md:grid-cols-2">
        <motion.div whileHover={{ y: -6 }} className="glass glass-hover rounded-2xl p-8">
          <h2 className="font-serif text-2xl font-bold text-sakura-600">🟢 Online exams</h2>
          <p className="mt-3 text-ink/70">
            Papers are assembled the instant a student begins, so questions stay secret. A full
            browser lockdown plus live AI proctoring keeps every attempt fair.
          </p>
        </motion.div>
        <motion.div whileHover={{ y: -6 }} className="glass glass-hover rounded-2xl p-8">
          <h2 className="font-serif text-2xl font-bold text-sakura-600">📄 Offline exams</h2>
          <p className="mt-3 text-ink/70">
            Upload a huge question bank, choose your set configuration, and Exam Shield generates
            balanced, printable PDF papers — timed to release just before the exam.
          </p>
        </motion.div>
      </div>

      <footer className="mt-20 text-center text-sm text-ink/40">
        🌸 Exam Shield — reimagining examinations, beautifully.
      </footer>
    </div>
  );
}
