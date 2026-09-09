import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { sfx } from '../../utils/sounds';
import { getLevelInfo } from '../../utils/xp';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  items: NavItem[];
  currentPath: string;
  userName?: string;
  onLogout?: () => void;
  open?: boolean;
  onClose?: () => void;
}

function SidebarContent({ items, currentPath, userName, onLogout, layoutIdPrefix = 'desktop' }: Omit<SidebarProps, 'open' | 'onClose'> & { layoutIdPrefix?: string }) {
  const { user } = useAuthStore();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}          <div className="p-6 border-b border-border-color">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="flex items-center space-x-3"
        >            <div className="w-10 h-10 rounded-lg accent-gradient flex items-center justify-center text-xl shadow-lg shadow-accent/30">
            ⚔️
          </div>
          <div>
            <h1 className="font-display text-lg text-white font-bold tracking-wider">
              HUNTER
            </h1>
            <p className="text-[10px] text-accent-text tracking-[0.3em] uppercase">
              System Online
            </p>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {items.map((item, index) => {
          const isActive = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => sfx.click()}
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className={`
                  relative flex items-center space-x-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200
                  ${isActive
                    ? 'bg-accent-bg text-accent-text shadow-inner shadow-accent/10'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId={`${layoutIdPrefix}ActiveIndicator`}
                    className="absolute left-0 w-1 h-8 bg-sidebar-active rounded-r-full shadow-[0_0_10px_var(--sidebar-indicator-shadow)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
                <span className="text-xl">{item.icon}</span>
                <span className="font-mono text-sm tracking-wider uppercase">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User Status & Logout */}        <div className="p-4 border-t border-border-color">
        <div className="bg-gradient-to-r from-accent-bg to-blue-500/10 rounded-lg p-3 border border-accent-border mb-3">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-accent-bg flex items-center justify-center text-sm">
              🎯
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-white truncate">{userName || 'Hunter-01'}</p>
              <p className="text-xs text-accent-text">Rank {user?.rank || 'E'}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>XP</span>
              <span>{((user?.xp ?? 0) || 0).toLocaleString()} / {getLevelInfo(user?.xp ?? 0).nextLevelXP.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full accent-gradient"
                initial={{ width: 0 }}
                animate={{ width: `${getLevelInfo(user?.xp ?? 0).intoLevel / (getLevelInfo(user?.xp ?? 0).nextLevelXP - getLevelInfo(user?.xp ?? 0).currentLevelXP) * 100}%` }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={() => {
              sfx.logout();
              onLogout();
            }}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-all font-mono text-sm"
          >
            <span>🚪</span>
            <span>LOGOUT</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ items, currentPath, userName, onLogout, open = false, onClose }: SidebarProps) {
  const baseProps = { items, currentPath, userName, onLogout };

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="hidden md:flex w-64 bg-[#0d1117]/95 backdrop-blur-xl border-r border-border-color flex-col"
      >
        <SidebarContent {...baseProps} />
      </motion.aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
        {open && (
          <motion.aside
            key="sidebar-drawer"
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#0d1117] border-r border-border-color md:hidden"
          >
            <SidebarContent {...baseProps} layoutIdPrefix="drawer" />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}