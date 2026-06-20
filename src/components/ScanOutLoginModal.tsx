import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, User, Lock, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ScanOutLoginModalProps {
  isOpen: boolean;
}

export function ScanOutLoginModal({ isOpen }: ScanOutLoginModalProps) {
  const { login, currentUser } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !currentUser) {
      setTimeout(() => usernameRef.current?.focus(), 300);
    }
  }, [isOpen, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await login(username, password);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error || 'Đăng nhập thất bại.');
      setPassword('');
    }
  };

  if (!isOpen || currentUser) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-sm"
        >
          {/* Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 text-center border-b border-slate-700/50">
              <div className="w-16 h-16 mx-auto mb-4 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/30">
                <ShieldCheck className="w-8 h-8 text-rose-400" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">SCAN OUT</h2>
              <p className="text-sm text-slate-400 mt-1 font-medium">Đăng nhập để tiếp tục</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              {/* Username */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Tài khoản
                </label>
                <div className="relative">
                  <input
                    ref={usernameRef}
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(null); }}
                    autoComplete="username"
                    autoCapitalize="none"
                    placeholder="Nhập username..."
                    className="w-full bg-slate-900/70 border border-slate-600 focus:border-rose-500 rounded-xl px-4 py-3 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-rose-500/30 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Mật khẩu
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  autoComplete="current-password"
                  placeholder="Nhập password..."
                  className="w-full bg-slate-900/70 border border-slate-600 focus:border-rose-500 rounded-xl px-4 py-3 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-rose-500/30 focus:outline-none transition-all"
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm font-bold"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full bg-rose-500 hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl shadow-lg shadow-rose-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-base"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
              </button>
            </form>

            <div className="px-8 pb-6 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              Session sẽ hết khi tải lại trang
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
