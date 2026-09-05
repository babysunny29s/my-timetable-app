-- Thêm cột user_id và policy RLS theo từng tài khoản
-- Chạy trong Supabase → SQL Editor

alter table public.lessons
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists lessons_user_id_idx on public.lessons (user_id);

alter table public.lessons enable row level security;

drop policy if exists "lessons_select_own" on public.lessons;
drop policy if exists "lessons_insert_own" on public.lessons;
drop policy if exists "lessons_update_own" on public.lessons;
drop policy if exists "lessons_delete_own" on public.lessons;

-- Xóa các policy anon mở cũ nếu còn (đổi tên cho khớp project của bạn nếu cần)
drop policy if exists "Enable read access for all users" on public.lessons;
drop policy if exists "Enable insert for all users" on public.lessons;
drop policy if exists "Enable update for all users" on public.lessons;
drop policy if exists "Enable delete for all users" on public.lessons;

create policy "lessons_select_own"
  on public.lessons for select
  to authenticated
  using (auth.uid() = user_id);

create policy "lessons_insert_own"
  on public.lessons for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "lessons_update_own"
  on public.lessons for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lessons_delete_own"
  on public.lessons for delete
  to authenticated
  using (auth.uid() = user_id);
