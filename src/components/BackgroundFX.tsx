import { useMemo } from 'react';

const PARTICLE_COUNT = 26;

/**
 * Ambient "system" background: drifting aurora glows, rising ember particles,
 * a faint grid, and a slow scanline sweep. All colors are driven by CSS
 * variables set per theme so the background changes with each accent.
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
      {/* Aurora blobs — colors from CSS variables, transition with theme */}
      <div
        className="absolute -top-48 -left-48 w-[36rem] h-[36rem] rounded-full blur-[130px] animate-aurora-1"
        style={{ background: 'var(--aurora-1)', transition: 'background 0.8s ease' }}
      />
      <div
        className="absolute top-1/3 -right-48 w-[32rem] h-[32rem] rounded-full blur-[130px] animate-aurora-2"
        style={{ background: 'var(--aurora-2)', transition: 'background 0.8s ease' }}
      />
      <div
        className="absolute -bottom-48 left-1/4 w-[30rem] h-[30rem] rounded-full blur-[130px] animate-aurora-3"
        style={{ background: 'var(--aurora-3)', transition: 'background 0.8s ease' }}
      />

      {/* Faint system grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(var(--grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          transition: 'background-image 0.8s ease',
        }}
      />

      {/* Rising ember particles */}
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-0 rounded-full animate-particle-rise"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            opacity: p.opacity,
            background: 'var(--particle-color)',
            boxShadow: '0 0 6px var(--particle-glow)',
            transition: 'background 0.8s ease, box-shadow 0.8s ease',
          }}
        />
      ))}

      {/* Slow scanline sweep */}
      <div
        className="absolute inset-x-0 h-1/3 animate-scan-sweep"
        style={{
          background: 'linear-gradient(to bottom, transparent, var(--scan-color), transparent)',
          transition: 'background 0.8s ease',
        }}
      />
    </div>
  );
}
