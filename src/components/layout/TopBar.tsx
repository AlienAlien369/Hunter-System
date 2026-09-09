import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function TopBar() {
  const location = useLocation();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-[#0d1117]/95 backdrop-blur-xl border-b border-purple-500/20 px-6 py-4"
    >
      <div className="flex items-center justify-between">
        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Breadcrumb */}
        <nav className="hidden md:flex items-center space-x-2 text-sm">
          <span className="text-gray-500">Home</span>
          <span className="text-gray-600">/</span>
          <span className="text-purple-400 font-mono uppercase tracking-wider">
            {location.pathname.replace('/', '') || 'Dashboard'}
          </span>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">
          {/* System Status */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-mono">SYSTEM ONLINE</span>
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
