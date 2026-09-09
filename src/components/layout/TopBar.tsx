import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

interface TopBarProps {
  onMenuToggle?: () => void;
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const location = useLocation();
  const pageTitle = location.pathname.replace('/', '') || 'Dashboard';

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-[#0d1117]/95 backdrop-blur-xl border-b border-purple-500/20 px-4 sm:px-6 py-3 sm:py-4"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb (desktop) / Page title (mobile) */}
        <nav className="flex items-center min-w-0 flex-1">
          <span className="hidden md:inline text-gray-500">Home</span>
          <span className="hidden md:inline text-gray-600 mx-2">/</span>
          <span className="text-purple-400 font-mono uppercase tracking-wider text-sm truncate">
            {pageTitle}
          </span>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
          {/* System Status */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-mono">SYSTEM ONLINE</span>
          </div>

          {/* Mobile-only status dot */}
          <div className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20" title="System online">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}