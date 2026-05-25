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

### MongoDB Atlas cho du lieu MongoDB

Backend uu tien `DATABASE_URL_MONGO` neu bien nay co gia tri. Neu bien nay de
trong, backend van dung `MONGODB_URI` de chay MongoDB local.

1. Tao MongoDB Atlas cluster va database user cho backend.
2. Them IP cua may/server chay backend vao Atlas IP access list, hoac dung
network path rieng cua Atlas neu moi truong deploy da cau hinh.
3. Lay connection string driver tu Atlas va dat env:

```env
DATABASE_URL_MONGO=mongodb+srv://atlas_user:atlas_password@cluster0.xxxxx.mongodb.net/zalo_app?retryWrites=true&w=majority
```

Du lieu MongoDB local cu khong tu dong chuyen sang Atlas. Neu can giu du
lieu bai viet, binh luan, hoi thoai, tin nhan, va thong bao hien tai, export
MongoDB local va import/migrate sang Atlas truoc khi deploy.

### EC2 backend voi RDS va Atlas

Dung `docker-compose.ec2.yml` khi backend chay tren EC2 va database da tach ra
RDS MariaDB + MongoDB Atlas. Compose nay chi chay backend va giu thu muc
`uploads` tren EC2:

```bash
docker compose -f docker-compose.ec2.yml up -d --build
```

File `.env` tren EC2 can co toi thieu:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL_MARIA=mariadb://admin:password@your-rds-endpoint:3306/zalo_app
DATABASE_URL_MONGO=mongodb+srv://atlas_user:atlas_password@cluster0.xxxxx.mongodb.net/zalo_app?retryWrites=true&w=majority
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
CORS_ORIGINS=https://your-web-domain
```

Dat EC2 cung VPC voi RDS, sau do cho security group cua EC2 truy cap port
`3306` tren security group cua RDS. MongoDB Atlas can cho phep dia chi outbound
cua EC2 qua Atlas IP access list hoac network access ma ban da cau hinh.

## 5. Socket.IO auth

Client gui token qua `auth.token` khi connect socket.
Backend se verify JWT truoc khi chap nhan ket noi.
