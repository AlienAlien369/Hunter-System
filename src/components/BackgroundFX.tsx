import { useMemo } from 'react';

const PARTICLE_COUNT = 26;

/**
 * Ambient "system" background: drifting aurora glows, rising ember particles,
 * a faint grid, and a slow scanline sweep. Pure CSS animations, GPU friendly.
 */
export default function BackgroundFX() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        left: `${(i * 37 + 13) % 100}%`,
        size: 2 + ((i * 7) % 4),
        delay: `${(i % 10) * 1.4}s`,
        duration: `${9 + ((i * 13) % 11)}s`,
        opacity: 0.12 + (i % 5) * 0.06,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Aurora blobs */}
      <div className="absolute -top-48 -left-48 w-[36rem] h-[36rem] rounded-full bg-purple-700/25 blur-[130px] animate-aurora-1" />
      <div className="absolute top-1/3 -right-48 w-[32rem] h-[32rem] rounded-full bg-blue-600/20 blur-[130px] animate-aurora-2" />
      <div className="absolute -bottom-48 left-1/4 w-[30rem] h-[30rem] rounded-full bg-fuchsia-600/15 blur-[130px] animate-aurora-3" />

      {/* Faint system grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(rgba(139, 92, 246, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.12) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Rising ember particles */}
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-0 rounded-full bg-purple-300 animate-particle-rise"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            opacity: p.opacity,
            boxShadow: '0 0 6px rgba(168, 85, 247, 0.8)',
          }}
        />
      ))}

      {/* Slow scanline sweep */}
      <div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-purple-400/10 to-transparent animate-scan-sweep" />
    </div>
  );
}