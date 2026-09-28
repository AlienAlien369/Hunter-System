import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Shared building blocks for the module pages, matching the existing
// ActiveQuests / HunterNameEntry visual language.

export function Panel({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[#0d1117]/90 backdrop-blur-xl rounded-xl border border-purple-500/30 overflow-hidden ${className}`}
    >
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 px-4 sm:px-6 py-3 border-b border-purple-500/20 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-white font-bold tracking-[0.3em] text-sm">{title}</h2>
        {right}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </motion.section>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }} // never block clicks while fading out
          onMouseDown={e => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.95, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 16 }}
            className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl p-5 sm:p-6 shadow-2xl`}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-white font-bold tracking-[0.2em] text-sm sm:text-base">{title}</h2>
              <button type="button" onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none" aria-label="Close">×</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const inputCls =
  'w-full bg-[#161b22] border border-purple-500/20 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-purple-400';

const VARIANTS = {
  primary: 'bg-purple-600/80 hover:bg-purple-500 text-white border-purple-400/40',
  ghost: 'bg-transparent hover:bg-purple-500/10 text-purple-300 border-purple-500/30',
  danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30',
};

export function Btn({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type="button"
      {...props}
      className={`px-3 py-2 rounded-lg border text-xs font-mono tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function XpDelta({ xp, className = '' }: { xp: number; className?: string }) {
  const color = xp > 0 ? 'text-green-400' : xp < 0 ? 'text-red-400' : 'text-gray-500';
  return <span className={`font-display font-bold ${color} ${className}`}>{xp > 0 ? '+' : ''}{xp} XP</span>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-[#161b22]/80 border border-purple-500/15 px-3 py-2">
      <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="font-display text-white text-lg">{value}</p>
    </div>
  );
}
