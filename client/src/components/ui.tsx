import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function Card({
  children,
  className = '',
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`glass ${hover ? 'glass-hover' : ''} rounded-2xl p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function Button({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      {...(props as any)}
      className={`btn-glow rounded-xl bg-gradient-to-r from-sakura-400 via-sakura-500 to-sakura-600 px-5 py-2.5 font-medium text-white shadow-glass transition hover:shadow-[0_12px_30px_rgba(216,31,100,0.4)] disabled:opacity-50 ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink/70">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-sakura-200 bg-white/80 px-4 py-2.5 outline-none focus:border-sakura-400 focus:ring-2 focus:ring-sakura-200';
