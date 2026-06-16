import { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Falling sakura (cherry-blossom) petals — the signature Japanese theme.
 * Renders lightweight CSS petals animated with Framer Motion across the viewport.
 */
export function SakuraPetals({ count = 24 }: { count?: number }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 8 + Math.random() * 12,
        delay: Math.random() * 8,
        duration: 8 + Math.random() * 8,
        drift: (Math.random() - 0.5) * 200,
        rotate: Math.random() * 360,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {petals.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -40, x: 0, opacity: 0, rotate: p.rotate }}
          animate={{
            y: '110vh',
            x: [0, p.drift / 2, p.drift],
            opacity: [0, 0.9, 0.9, 0],
            rotate: p.rotate + 360,
          }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
          style={{ left: `${p.left}%`, width: p.size, height: p.size }}
          className="absolute top-0"
        >
          <div
            style={{ width: p.size, height: p.size }}
            className="rounded-tl-full rounded-br-full bg-gradient-to-br from-sakura-200 to-sakura-400 opacity-80"
          />
        </motion.div>
      ))}
    </div>
  );
}
