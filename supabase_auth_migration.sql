-- =============================================
-- MIGRATION: Scan Out Authentication System
-- Chạy script này trong Supabase SQL Editor
-- =============================================

-- 1. Tạo bảng scan_users
CREATE TABLE IF NOT EXISTS public.scan_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.scan_users ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc và ghi với anon key (frontend dùng anon key)
CREATE POLICY "Allow all for anon" ON public.scan_users
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Thêm cột scanned_by vào scan_logs
ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS scanned_by TEXT DEFAULT NULL;

-- 3. Seed 13 tài khoản ban đầu
-- Mật khẩu được hash SHA-256 (tính từ: username + ':' + password)
-- tt:45, vn:36, nh:67, vb:49, mt:65, dt:78, ht:61, tt1:23, th:82, tt2:74, te:43, bt:76, vk:54

INSERT INTO public.scan_users (username, password_hash) VALUES
  ('tt',  encode(sha256('tt:45'::bytea),  'hex')),
  ('vn',  encode(sha256('vn:36'::bytea),  'hex')),
  ('nh',  encode(sha256('nh:67'::bytea),  'hex')),
  ('vb',  encode(sha256('vb:49'::bytea),  'hex')),
  ('mt',  encode(sha256('mt:65'::bytea),  'hex')),
  ('dt',  encode(sha256('dt:78'::bytea),  'hex')),
  ('ht',  encode(sha256('ht:61'::bytea),  'hex')),
  ('tt1', encode(sha256('tt1:23'::bytea), 'hex')),
  ('th',  encode(sha256('th:82'::bytea),  'hex')),
  ('tt2', encode(sha256('tt2:74'::bytea), 'hex')),
  ('te',  encode(sha256('te:43'::bytea),  'hex')),
  ('bt',  encode(sha256('bt:76'::bytea),  'hex')),
  ('vk',  encode(sha256('vk:54'::bytea),  'hex'))
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- XONG! Kiểm tra kết quả:
-- SELECT username, created_at FROM scan_users ORDER BY created_at;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'scan_logs' AND column_name = 'scanned_by';
-- =============================================
