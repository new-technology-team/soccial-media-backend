# ZConnect - Mạng xã hội công nghệ mới

**ZConnect** là dự án mạng xã hội full-stack được xây dựng trong khuôn khổ môn học **Công nghệ mới**. Dự án ban đầu là sản phẩm của team nhóm, sau đó được clone về và custom, phát triển thêm nhiều tính năng.

---

## Công nghệ sử dụng

### Backend (`soccial-media-backend/`)
- **NestJS** — Framework Node.js server-side
- **TypeORM** + **MySQL/MariaDB** — ORM và cơ sở dữ liệu quan hệ
- **Passport.js** — Xác thực JWT, Google OAuth, GitHub OAuth
- **Socket.IO** — Real-time chat, thông báo
- **LangChain** + **Google Generative AI** — Chat AI thông minh
- **AWS S3** — Lưu trữ và upload file
- **Nodemailer** — Gửi email OTP, thông báo
- **Swagger** — Tài liệu API tự động

### Frontend (`soccial-media-web/`)
- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS 4** + **shadcn/ui** — UI components
- **React Router v7** — Điều hướng
- **Zustand** — Quản lý state
- **Socket.IO Client** — Kết nối real-time
- **Framer Motion** — Animation
- **Recharts** — Biểu đồ thống kê
- **React Hook Form** + **Zod** — Form validation

---

## Cấu trúc dự án

```
/
├── soccial-media-backend/     # Backend NestJS
│   ├── src/
│   │   ├── module/
│   │   │   ├── auth/          # Xác thực (JWT, OAuth, OTP)
│   │   │   ├── user/          # Quản lý người dùng
│   │   │   ├── post/          # Bài viết
│   │   │   ├── comment/       # Bình luận
│   │   │   ├── conversation/  # Cuộc hội thoại
│   │   │   ├── message/       # Tin nhắn real-time
│   │   │   ├── friendship/    # Kết bạn
│   │   │   ├── notification/  # Thông báo
│   │   │   ├── discovery/     # Khám phá / gợi ý
│   │   │   ├── ai/            # AI chat, phân tích cảm xúc
│   │   │   ├── report/        # Báo cáo vi phạm
│   │   │   └── system-setting/ # Cài đặt hệ thống
│   │   ├── common/            # Shared (guards, decorators, socket)
│   │   └── main.ts            # Entry point
│   └── database/              # Scripts SQL
│
└── soccial-media-web/         # Frontend React
    └── src/
        ├── pages/
        │   ├── (app)/
        │   │   ├── feed/          # Bảng tin chính
        │   │   ├── messages/      # Tin nhắn
        │   │   ├── friends/       # Bạn bè
        │   │   ├── explore/       # Khám phá / xu hướng
        │   │   ├── notifications/ # Thông báo
        │   │   ├── profile/       # Hồ sơ cá nhân
        │   │   ├── ai-chat/       # Chat AI
        │   │   ├── media/         # Media gallery
        │   │   ├── posts/         # Chi tiết bài viết
        │   │   ├── admin/         # Quản trị hệ thống
        │   │   ├── moderator/     # Kiểm duyệt nội dung
        │   │   └── settings/      # Cài đặt
        │   └── auth/              # Đăng nhập, đăng ký, OTP
        ├── components/
        │   ├── ui/                # shadcn/ui components
        │   ├── feed/              # Feed widgets
        │   ├── layouts/           # Layouts (App, Auth, Admin)
        │   ├── navigation/        # Sidebar, navbar
        │   ├── call/              # Tính năng gọi
        │   ├── dialogs/           # Dialog components
        │   ├── admin/             # Admin UI
        │   └── moderation/        # Moderation UI
        ├── contexts/              # Zustand stores
        ├── hooks/                 # Custom hooks
        ├── routes/                # Route config
        ├── services/              # API services
        └── types/                 # TypeScript types
```

---

## Tính năng chính

### Xã hội (Social)
- **Bảng tin** — Bài viết, tương tác (like, reaction), chia sẻ, bình luận
- **Kết bạn** — Gửi/chấp nhận/từ chối lời mời kết bạn, gợi ý kết bạn
- **Hồ sơ cá nhân** — Trang cá nhân, chỉnh sửa thông tin
- **Khám phá** — Xu hướng, hashtag, nội dung nổi bật
- **Media** — Ảnh, video trong bài viết

### Tin nhắn (Messaging)
- **Chat real-time** — Gửi tin nhắn 1-1 và nhóm qua Socket.IO
- **Danh sách hội thoại** — Quản lý hội thoại, tìm kiếm
- **Chi tiết hội thoại** — Thành viên, tệp đính kèm
- **Gọi thoại/video** — Tích hợp tính năng gọi (Twilio)

### AI
- **Chat AI** — Trò chuyện với AI (Google Gemini)
- **Phân tích cảm xúc** — Phân tích tâm trạng bài viết
- **Gợi ý trả lời** — Đề xuất nội dung phản hồi
- **Tóm tắt chat** — Tóm tắt nội dung hội thoại

### Quản trị & Kiểm duyệt
- **Admin dashboard** — Thống kê, quản lý người dùng, bài viết
- **Moderation queue** — Duyệt báo cáo, xử lý vi phạm
- **Audit logs** — Lịch sử hoạt động

### Xác thực
- **Đăng nhập / Đăng ký** — JWT, OTP email
- **OAuth** — Google, GitHub
- **Quên mật khẩu** — Reset qua email

---

## Yêu cầu hệ thống

- **Node.js** >= 18
- **MySQL** hoặc **MariaDB**
- **npm** / **pnpm**

## Cài đặt & Chạy

### Backend

```bash
cd soccial-media-backend
cp .env.example .env    # Cấu hình database, JWT secret,...
npm install
npm run start:dev       # http://localhost:3000
# API docs: http://localhost:3000/api
```

### Frontend

```bash
cd soccial-media-web
npm install
npm run dev             # http://localhost:8088
```

## Biến môi trường

### Backend
| Biến | Mô tả |
|------|-------|
| `DB_HOST` | Database host |
| `DB_PORT` | Database port |
| `DB_USERNAME` | Database user |
| `DB_PASSWORD` | Database password |
| `DB_DATABASE` | Database name |
| `JWT_SECRET` | JWT signing key |
| `OTP_SECRET` | OTP secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GEMINI_API_KEY` | Google Gemini API key |
| `AWS_*` | AWS S3 credentials |
| `MAIL_*` | SMTP mail config |

### Frontend
| Biến | Mô tả |
|------|-------|
| `VITE_API_URL` | Backend API URL |
| `VITE_SOCKET_URL` | WebSocket URL |

---

## Liên kết

- **GitHub**: [https://github.com/minhnt2510/zconnect](https://github.com/minhnt2510/zconnect)
