-- Thêm cột note đặc biệt (thi GK/CK, thuyết trình...)
-- Chạy trong Supabase → SQL Editor

alter table public.lessons
  add column if not exists special_note text;
