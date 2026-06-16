import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`glass rounded-2xl p-6 ${className}`}
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
    <button
      {...props}
      className={`rounded-xl bg-gradient-to-r from-sakura-500 to-sakura-600 px-5 py-2.5 font-medium text-white shadow-glass transition hover:brightness-105 active:scale-[.98] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
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
