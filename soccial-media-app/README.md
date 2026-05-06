# ZChat Mobile App

Ứng dụng di động của ZChat được xây dựng với Expo (React Native).

## Chạy ứng dụng

### 1. Cài đặt dependencies

```bash
cd soccial-media-app
npm install
```

### 2. Cấu hình môi trường

Sao chép file `.env.example` thành `.env` và chỉnh sửa URL phù hợp:

```bash
cp .env.example .env
```

**Lưu ý về URL:**
- **Android Emulator (AVD):** Dùng `http://10.0.2.2:5000` (trỏ đến localhost của máy host)
- **iOS Simulator:** Dùng `http://localhost:5000`
- **Thiết bị thật:** Dùng IP local của máy tính (VD: `http://192.168.1.x:5000`)

### 3. Chạy ứng dụng

```bash
# Development
npm start

# Android
npm run android

# iOS
npm run ios
```

### 4. Build APK (Android)

```bash
# Cài đặt EAS CLI nếu chưa có
npm install -g eas-cli

# Build development APK
eas build -p android --profile development
```

## Tính năng

- **Đăng nhập / Đăng ký** với xác thực OTP
- **Bảng tin (Feed)** - Xem, đăng bài, thích, bình luận
- **Tin nhắn** - Nhắn tin với bạn bè
- **Thông báo** - Nhận thông báo hoạt động
- **Hồ sơ** - Xem và chỉnh sửa thông tin cá nhân
- **Tìm kiếm** - Tìm kiếm người dùng

## Theme

Ứng dụng sử dụng theme giống với web app:
- **Primary:** `#0052ce` (Blue)
- **Background:** `#f3f5f8`
- **Surface:** `#ffffff`
- Font chữ: System font mặc định
