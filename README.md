# Timetable App

Ứng dụng lịch học cá nhân: xem lịch tháng (kèm âm lịch Việt Nam), quản lý tiết học trên cloud với Supabase Auth.

## Kiến trúc tổng quan

```
Người dùng (Browser)
        │
        ▼
┌───────────────────┐
│  Vite + React SPA │
│  AuthScreen       │◄── chưa đăng nhập
│  App.jsx (lịch)   │◄── đã đăng nhập
│  lunar.js         │
│  supabase.js      │
└─────────┬─────────┘
          │ @supabase/supabase-js
          ▼
┌───────────────────┐
│     Supabase      │
│  Auth (username)  │
│  Postgres + RLS   │
│  bảng: lessons    │
└───────────────────┘
```

## Tính năng hiện có

| Khu vực | Chi tiết |
|--------|----------|
| Auth | Đăng ký / Đăng nhập bằng username + mật khẩu, Đăng xuất |
| Lịch tháng | Lưới T2–CN, ngày tháng trước/sau, chọn ngày |
| Âm lịch | Hiển thị trong ô lịch + phần chi tiết ngày |
| Tiết học | Thêm / Sửa / Xóa, lưu Supabase, F5 không mất |
| UI | Phong cách sổ học tập (header cam, khoen binder, bottom nav) |

## Cấu trúc thư mục

```
timetable-app/
├── .env.local                 # VITE_SUPABASE_* (không commit)
├── supabase-auth-setup.sql    # user_id + RLS
├── index.html
├── package.json
└── src/
    ├── main.jsx               # Entry
    ├── App.jsx                # Auth gate + lịch + CRUD + settings
    ├── App.css
    ├── AuthScreen.jsx         # Màn đăng nhập / đăng ký
    ├── Auth.css
    ├── supabase.js            # createClient
    ├── lunar.js               # Dương lịch → Âm lịch
    └── index.css
```

## Mô hình dữ liệu

### Bảng `public.lessons`

| Cột | Kiểu gợi ý | Mô tả |
|-----|------------|--------|
| `id` | uuid / bigserial | Khóa chính |
| `user_id` | uuid → `auth.users` | Chủ sở hữu (RLS) |
| `date` | date | Ngày học `YYYY-MM-DD` |
| `time` | time | Giờ học (UI dùng `HH:mm`) |
| `subject` | text | Môn học |
| `room` | text | Phòng |
| `note` | text (nullable) | Ghi chú thường |
| `special_note` | text (nullable) | Note đặc biệt (Thi GK, CK, thuyết trình...) — hiện nổi trên lịch |

### RLS (tóm tắt)

Mỗi user chỉ `SELECT` / `INSERT` / `UPDATE` / `DELETE` row có `user_id = auth.uid()`.

Chạy file `supabase-auth-setup.sql` trong **Supabase → SQL Editor**.

## Auth (username)

UI dùng **tên đăng nhập**, không hiện email.

Supabase Auth vẫn cần email nội bộ phía sau: `username@timetable.local`  
(username được lưu thêm trong `user_metadata.username`).

**Quan trọng:** tắt **Confirm email** trong Supabase → Authentication → Providers / Settings, vì email `@timetable.local` không nhận được thư xác nhận.

Tên đăng nhập hợp lệ: `3–20` ký tự, chỉ `a-z`, `0-9`, `_`.

### Luồng Auth

1. `getSession()` khi mở app  
2. Không session → `AuthScreen`  
3. `signInWithPassword` / `signUp` với email nội bộ từ username  
4. `onAuthStateChange` cập nhật UI  
5. Settings → `signOut()`

### CRUD tiết học

| Hành động | Gọi API |
|-----------|---------|
| Đọc | `from('lessons').select('*').order(...)` |
| Thêm | `insert({ ..., user_id })` |
| Sửa | `update(...).eq('id', editingId)` |
| Xóa | `delete().eq('id', id)` |

## Import lịch từ PDF (Gemini)

1. Lấy API key tại [Google AI Studio](https://aistudio.google.com/apikey)
2. Thêm vào `.env.local`:

```env
VITE_GEMINI_API_KEY=...
```

3. Restart `npm run dev`
4. Trong app → tab **Import lịch** → chọn PDF + mã HP → Phân tích → chọn buổi → Lưu

Lưu ý: key trên client chỉ phù hợp prototype cá nhân. Production nên chuyển gọi Gemini sang Edge Function.


```bash
cd timetable-app
npm install
```

Tạo `.env.local`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Trên Supabase:

1. Chạy `supabase-auth-setup.sql`
2. Authentication → Providers → bật **Email**
3. (Học nhanh) tắt **Confirm email** nếu muốn vào app ngay sau đăng ký

```bash
npm run dev
```

Mở http://localhost:5173

## Phụ thuộc chính

- `react` / `react-dom`
- `vite` + `@vitejs/plugin-react`
- `@supabase/supabase-js`

## Gợi ý phát triển tiếp

- View **Thời khóa biểu** (tuần)
- Tab **Ghi chú**
- Quên mật khẩu
- Realtime sync `lessons`
- PWA / nhắc giờ học
