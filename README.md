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

### Email Configuration (SMTP)

To enable email functionality for registration verification, password reset, and notifications:

1. Copy `.env.example` to `.env` (if not already done)
2. Configure SMTP settings in `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-specific-password
   SMTP_FROM=noreply@zzchat.com
   ```

3. For Gmail:
   - Enable "Less secure app access" or use App Password
   - Go to https://myaccount.google.com/apppasswords
   - Generate an app password and use it in `SMTP_PASSWORD`

4. For other email providers (Outlook, SendGrid, etc.):
   - Update `SMTP_HOST` to your provider's SMTP server
   - Update port and security settings accordingly

The system will automatically send OTP codes via email when users register or request password reset.

### Endpoint auth

- `POST /api/auth/register` - Send verification OTP to email/phone
- `POST /api/auth/verify-registration` - Verify registration with OTP code
- `POST /api/auth/resend-verification` - Resend verification OTP
- `POST /api/auth/login`
- `POST /api/auth/forgot-password` - Send password reset OTP to email
- `POST /api/auth/reset-password` - Reset password with OTP code
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
