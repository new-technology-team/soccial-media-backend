# Frontend - React + Vite

Frontend đã được chuẩn hoá theo cấu trúc React tiêu chuẩn kiểu `src`-centric.

## 1. Công nghệ

- React 19 + TypeScript
- Vite
- React Router
- Tailwind CSS
- Zustand

## 2. Cấu trúc thư mục

```text
frontend/
  public/
  src/
    pages/            # pages theo module tính năng
    layouts/          # layout dùng cho auth/app/admin
    routes/           # route modules (auth/app/admin) + index
    components/       # UI components dùng lại
    hooks/            # custom hooks
    lib/              # api client, types, utils, store
    styles/           # style dùng chung
    main.tsx          # entry point
    router.tsx        # compatibility re-export
    vite-env.d.ts
  server/             # backend nội bộ (nếu dùng)
  vite.config.ts
  tsconfig.json
  package.json
```

## 3. Cài đặt

```bash
cd frontend
npm install
cp .env.example .env
```

## 4. ENV chính

- `VITE_API_BASE_URL` (fallback vẫn hỗ trợ `NEXT_PUBLIC_API_BASE_URL`)
- `VITE_SOCKET_URL` (fallback vẫn hỗ trợ `NEXT_PUBLIC_SOCKET_URL`)

## 5. Chạy frontend

```bash
npm run dev
```

Mặc định chạy tại `http://localhost:8088`.

## 6. Build frontend

```bash
npm run build
npm run preview
```

## 7. Ghi chú

- Alias `@/*` trỏ về `src/*`.
- Vite proxy đã cấu hình sẵn cho `/backend`, `/uploads`, `/socket.io`.
