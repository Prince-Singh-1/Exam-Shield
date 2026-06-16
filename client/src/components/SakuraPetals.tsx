import { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Falling sakura (cherry-blossom) petals + cherry-tree silhouettes —
 * the signature Japanese theme. Denser petal field with varied shapes,
 * sizes, sway and rotation for a lush, atmospheric effect.
 */
export function SakuraPetals({ count = 60 }: { count?: number }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 6 + Math.random() * 16,
        delay: Math.random() * 12,
        duration: 9 + Math.random() * 12,
        drift: (Math.random() - 0.5) * 320,
        rotate: Math.random() * 360,
        spin: 360 + Math.random() * 540,
        opacity: 0.5 + Math.random() * 0.5,
        hue: Math.random() > 0.5 ? 'from-sakura-200 to-sakura-400' : 'from-sakura-100 to-sakura-300',
      })),
    [count],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Cherry-tree silhouettes for depth (bottom corners) */}
      <Tree className="absolute -bottom-6 -left-10 w-[40vw] max-w-[520px] opacity-30" flip={false} />
      <Tree className="absolute -bottom-6 -right-10 w-[42vw] max-w-[560px] opacity-25" flip />

      {petals.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -50, x: 0, opacity: 0, rotate: p.rotate }}
          animate={{
            y: '112vh',
            x: [0, p.drift / 3, p.drift / 1.5, p.drift],
            opacity: [0, p.opacity, p.opacity, 0],
            rotate: p.rotate + p.spin,
          }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          style={{ left: `${p.left}%`, width: p.size, height: p.size }}
          className="absolute top-0"
        >
          <div
            style={{ width: p.size, height: p.size }}
            className={`rounded-tl-full rounded-br-full bg-gradient-to-br ${p.hue} shadow-sm`}
          />
        </motion.div>
      ))}
    </div>
  );
}

/** Stylized cherry-tree silhouette built from layered blossom clusters. */
function Tree({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 400 320"
      className={className}
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
    >
      {/* trunk + branches */}
      <path
        d="M60 320 C70 230 90 190 130 150 C100 150 80 130 70 110 M130 150 C160 120 175 95 180 60 M130 150 C150 170 190 175 230 160 M130 150 C120 180 130 215 160 240"
        fill="none"
        stroke="#6b3b4a"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* blossom canopy */}
      {[
        [180, 55, 70], [120, 95, 60], [230, 120, 64], [80, 120, 48],
        [175, 110, 50], [250, 70, 46], [60, 70, 40], [200, 160, 44],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#ff9ebd" opacity={0.55} />
      ))}
      {[
        [170, 60, 40], [120, 100, 36], [225, 120, 38], [90, 115, 28], [205, 150, 26],
      ].map(([cx, cy, r], i) => (
        <circle key={`l${i}`} cx={cx} cy={cy} r={r} fill="#ffc2d6" opacity={0.6} />
      ))}
    </svg>
  );
}
