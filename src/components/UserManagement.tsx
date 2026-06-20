import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Lock, Plus, Trash2, KeyRound, Loader2, ShieldCheck, AlertCircle, CheckCircle2, Eye, EyeOff, LogOut } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// SHA-256 hash helper (same as AuthContext)
async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface ScanUser {
  id: string;
  username: string;
  created_at: string;
}

// ─── Admin Login Gate ─────────────────────────────────────────────────────────
function AdminLoginGate({ onSuccess }: { onSuccess: () => void }) {
  const { loginAdmin } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = loginAdmin(password);
    if (ok) {
      onSuccess();
    } else {
      setError('Sai mật khẩu admin!');
      setPassword('');
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm"
      >
        <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-8 pt-8 pb-6 text-center border-b border-slate-700/50">
            <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
              <ShieldCheck className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Quản Lý User</h2>
            <p className="text-sm text-slate-400 mt-1 font-medium">Nhập mật khẩu admin để tiếp tục</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Mật khẩu Admin
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="Nhập password admin..."
                  className="w-full bg-slate-900/70 border border-slate-600 focus:border-amber-500 rounded-xl px-4 py-3 pr-12 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500/30 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

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

            <button
              type="submit"
              disabled={!password}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl shadow-lg shadow-amber-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              Xác nhận
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main UserManagement Page ─────────────────────────────────────────────────
export function UserManagement() {
  const { isAdminAuthenticated, logoutAdmin } = useAuth();
  const [isAuth, setIsAuth] = useState(isAdminAuthenticated);

  const [users, setUsers] = useState<ScanUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Add user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Change password
  const [changingPassId, setChangingPassId] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isAuth) fetchUsers();
  }, [isAuth]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('scan_users')
        .select('id, username, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      showToast('Lỗi tải danh sách: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = newUsername.trim().toLowerCase();
    const pass = newPassword.trim();
    if (!uname || !pass) return;

    setIsAdding(true);
    try {
      const hash = await sha256Hash(`${uname}:${pass}`);
      const { error } = await supabase
        .from('scan_users')
        .insert({ username: uname, password_hash: hash });
      if (error) throw error;
      setNewUsername('');
      setNewPassword('');
      showToast(`✅ Đã thêm tài khoản "${uname}"`);
      fetchUsers();
    } catch (err: any) {
      if (err.code === '23505') {
        showToast(`Username "${uname}" đã tồn tại!`, 'error');
      } else {
        showToast('Lỗi thêm tài khoản: ' + err.message, 'error');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleChangePassword = async (userId: string, username: string) => {
    const pass = newPass.trim();
    if (!pass) return;
    setIsChanging(true);
    try {
      const hash = await sha256Hash(`${username}:${pass}`);
      const { error } = await supabase
        .from('scan_users')
        .update({ password_hash: hash })
        .eq('id', userId);
      if (error) throw error;
      setChangingPassId(null);
      setNewPass('');
      showToast(`✅ Đã đổi mật khẩu cho "${username}"`);
    } catch (err: any) {
      showToast('Lỗi đổi mật khẩu: ' + err.message, 'error');
    } finally {
      setIsChanging(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('scan_users')
        .delete()
        .eq('id', userId);
      if (error) throw error;
      setDeletingId(null);
      showToast(`🗑️ Đã xóa tài khoản "${username}"`);
      fetchUsers();
    } catch (err: any) {
      showToast('Lỗi xóa tài khoản: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };


  if (!isAuth) {
    return <AdminLoginGate onSuccess={() => setIsAuth(true)} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl font-bold text-white shadow-2xl flex items-center gap-2 ${
              toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 p-3 rounded-2xl border border-amber-500/30">
            <Users className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Quản Lý Tài Khoản</h1>
            <p className="text-sm text-slate-400">Tài khoản SCAN OUT — {users.length} tài khoản</p>
          </div>
        </div>
        <button
          onClick={() => { logoutAdmin(); setIsAuth(false); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700 transition-colors text-sm font-bold"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>

      {/* Add User Form */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50 space-y-4">
        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" /> Thêm Tài Khoản Mới
        </h2>
        <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="Username..."
            autoCapitalize="none"
            className="flex-1 bg-slate-900/70 border border-slate-600 focus:border-emerald-500 rounded-xl px-4 py-3 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none transition-all"
          />
          <input
            type="text"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Password..."
            className="flex-1 bg-slate-900/70 border border-slate-600 focus:border-emerald-500 rounded-xl px-4 py-3 text-white font-bold placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none transition-all"
          />
          <button
            type="submit"
            disabled={isAdding || !newUsername.trim() || !newPassword.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
          >
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Thêm
          </button>
        </form>
      </div>

      {/* User List */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" /> Danh Sách Tài Khoản
          </h2>
          <button
            onClick={fetchUsers}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest transition-colors"
          >
            Làm mới
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-bold italic">Chưa có tài khoản nào</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {users.map((user, idx) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="px-6 py-4 flex items-center gap-4"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-indigo-300 uppercase">
                    {user.username.slice(0, 2)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white tracking-wide">{user.username}</p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tạo: {new Date(user.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>

                {/* Change Password */}
                {changingPassId === user.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="Pass mới..."
                      autoFocus
                      className="w-28 bg-slate-900 border border-amber-500/50 focus:border-amber-500 rounded-lg px-3 py-2 text-white text-sm font-bold focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    />
                    <button
                      onClick={() => handleChangePassword(user.id, user.username)}
                      disabled={isChanging || !newPass.trim()}
                      className="p-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg transition-all"
                    >
                      {isChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => { setChangingPassId(null); setNewPass(''); }}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg transition-all"
                    >
                      ✕
                    </button>
                  </div>
                ) : deletingId === user.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-400 font-bold">Xóa "{user.username}"?</span>
                    <button
                      onClick={() => handleDeleteUser(user.id, user.username)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-xs font-black rounded-lg transition-all"
                    >
                      {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Xác nhận'}
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs font-bold rounded-lg transition-all"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setChangingPassId(user.id); setNewPass(''); setDeletingId(null); }}
                      className="p-2 bg-slate-700/60 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 rounded-xl border border-slate-600 transition-colors"
                      title="Đổi mật khẩu"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setDeletingId(user.id); setChangingPassId(null); }}
                      className="p-2 bg-slate-700/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-600 transition-colors"
                      title="Xóa tài khoản"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest pb-4">
        Scan Out Authentication System · Session Admin hết khi reload trang
      </div>
    </div>
  );
}
