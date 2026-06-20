import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../utils/supabaseClient';

// Hash function using Web Crypto API (SHA-256)
async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface AuthUser {
  username: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAdminAuthenticated: boolean;
  loginAdmin: (password: string) => boolean;
  logoutAdmin: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = 'scan_out_user';
const ADMIN_SESSION_KEY = 'scan_admin_auth';
const ADMIN_PASSWORD = 'admin'; // Có thể đổi thành password khác

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Khôi phục session từ sessionStorage khi load trang
  useEffect(() => {
    const savedUser = sessionStorage.getItem(SESSION_KEY);
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }

    const adminAuth = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (adminAuth === 'true') {
      setIsAdminAuthenticated(true);
    }
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedUser = username.trim().toLowerCase();
      const trimmedPass = password.trim();

      if (!trimmedUser || !trimmedPass) {
        return { success: false, error: 'Vui lòng nhập đầy đủ username và password.' };
      }

      // Hash theo format: username:password (khớp với SQL seed)
      const hash = await sha256Hash(`${trimmedUser}:${trimmedPass}`);

      const { data, error } = await supabase
        .from('scan_users')
        .select('username')
        .eq('username', trimmedUser)
        .eq('password_hash', hash)
        .maybeSingle();

      if (error) {
        console.error('Auth query error:', error);
        return { success: false, error: 'Lỗi kết nối, thử lại sau.' };
      }

      if (!data) {
        return { success: false, error: 'Sai username hoặc password.' };
      }

      const user: AuthUser = { username: data.username };
      setCurrentUser(user);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Lỗi không xác định.' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const loginAdmin = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isAdminAuthenticated, loginAdmin, logoutAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
