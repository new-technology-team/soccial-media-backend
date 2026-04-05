# Zalo Messaging App - Auth Module

Du an da duoc scaffold theo stack ban yeu cau:

- Backend: Node.js + MariaDB + Docker + JWT + AWS S3 + Socket.IO + Swagger
- Web Frontend: React + Vite + TypeScript + TailwindCSS
- Mobile App: React Native Expo + TypeScript

## 1. Backend

Thu muc: `backend`

### Chay voi Docker

```bash
cd backend
docker compose up -d
```

- API base: `http://localhost:5000`
- Swagger: `http://localhost:5000/api-docs`
- Health check: `http://localhost:5000/health`

### Endpoint auth

- `POST /api/auth/register`
- `POST /api/auth/verify-registration`
- `POST /api/auth/resend-verification`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/refresh`
- `GET /api/auth/me` (Bearer token)
- `PUT /api/auth/me` (Bearer token)
- `POST /api/auth/change-password` (Bearer token)
- `POST /api/auth/logout` (Bearer token)
- `POST /api/auth/avatar-upload-url` (Bearer token, AWS S3 pre-signed URL)

## 2. Web Frontend (React + Vite + TS + Tailwind)

Thu muc: `fontend`

```bash
cd fontend
npm install
npm run dev
```

Tao file `.env` tu `.env.example`:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

## 3. Mobile App (Expo + TS)

Thu muc: `app`

```bash
cd app
npm install
npm start
```

Khong dung `npm expo dev` (lenh nay sai), hay dung `npm start` hoac `npx expo start`.

Tao file `.env` tu `.env.example`:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
```

Luu y voi mobile thiet bi that: thay `localhost` bang IP LAN cua may chay backend.

## 4. Bien moi truong quan trong backend

Tao file `backend/.env` tu `backend/.env.example` va cap nhat:

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `DB_*`
- `CORS_ORIGINS`
- `AWS_*` neu can upload avatar len S3

## 5. Socket.IO auth

Client gui token qua `auth.token` khi connect socket.
Backend se verify JWT truoc khi chap nhan ket noi.
