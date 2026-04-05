import { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image
} from "react-native";
import { io, Socket } from "socket.io-client";
import { StatusBar } from "expo-status-bar";
import { api } from "./src/lib/api";
import { authStore } from "./src/lib/auth";

type Mode = "login" | "register" | "verify" | "forgot" | "reset" | "home";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:5000";

export default function App() {
  const [mode, setMode] = useState<Mode>("login");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newAuthPassword, setNewAuthPassword] = useState("");
  const [status, setStatus] = useState("Chưa đăng nhập");
  const [userName, setUserName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [createdAt, setCreatedAt] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);

  const modeTitle = useMemo(() => {
    switch (mode) {
      case "register":
        return "Đăng ký";
      case "verify":
        return "Xác thực";
      case "forgot":
        return "Quên mật khẩu";
      case "reset":
        return "Đặt lại mật khẩu";
      default:
        return "Đăng nhập";
    }
  }, [mode]);

  const connectRealtime = (accessToken: string) => {
    socket?.disconnect();

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: {
        token: accessToken
      }
    });

    newSocket.on("connected", (payload: { message: string }) => {
      setStatus(`${payload.message}`);
    });

    newSocket.on("connect_error", (error: Error) => {
      setStatus(`Lỗi kết nối: ${error.message}`);
    });

    setSocket(newSocket);
  };

  const handleSubmit = async () => {
    try {
      setStatus("Đang xử lý...");

      if (mode === "register") {
        const res = await api.register({ emailOrPhone, fullName: fullName || undefined, password, dateOfBirth: dateOfBirth || undefined, gender: (gender || undefined) as any });
        const otpDetail = res.otpSent
          ? ` OTP đã gửi qua ${res.otpChannel === "sms" ? "SMS" : "Email"}${res.otpDestination ? ` tới ${res.otpDestination}` : ""}.`
          : ` Gửi OTP thật thất bại (${res.otpReason || "unknown"}${res.otpError ? `: ${res.otpError}` : ""}).`;
        setStatus(`${res.message}${otpDetail}${res.verificationCode ? ` OTP demo: ${res.verificationCode}` : ""}`);
        setMode("verify");
        return;
      }

      if (mode === "verify") {
        const res = await api.verifyRegistration({ emailOrPhone, code });
        authStore.setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        setUserName(res.user.fullName);
        setProfileEmail(res.user.email || res.user.phone || "");
        setIsVerified(Boolean(res.user.isVerified));
        setCreatedAt(res.user.createdAt || "");
        setAvatarUrl(res.user.avatarUrl || "");
        setFullName(res.user.fullName);
        setDateOfBirth(res.user.dateOfBirth || "");
        setGender(res.user.gender || "");
        connectRealtime(res.accessToken);
        setStatus("Xác thực và đăng nhập thành công");
        setMode("home");
        return;
      }

      if (mode === "forgot") {
        const res = await api.forgotPassword(emailOrPhone);
        const otpDetail = res.otpSent
          ? ` Mã đã gửi qua ${res.otpChannel === "sms" ? "SMS" : "Email"}${res.otpDestination ? ` tới ${res.otpDestination}` : ""}.`
          : ` Gửi mã thật thất bại (${res.otpReason || "unknown"}${res.otpError ? `: ${res.otpError}` : ""}).`;
        setStatus(`${res.message}${otpDetail}${res.resetCode ? ` Mã demo: ${res.resetCode}` : ""}`);
        setMode("reset");
        return;
      }

      if (mode === "reset") {
        const res = await api.resetPassword({ emailOrPhone, code, newPassword });
        setStatus(res.message);
        setMode("login");
        return;
      }

      const res = await api.login({ emailOrPhone, password });
      authStore.setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUserName(res.user.fullName);
      setProfileEmail(res.user.email || res.user.phone || "");
      setIsVerified(Boolean(res.user.isVerified));
      setCreatedAt(res.user.createdAt || "");
      setAvatarUrl(res.user.avatarUrl || "");
      setFullName(res.user.fullName);
      setDateOfBirth(res.user.dateOfBirth || "");
      setGender(res.user.gender || "");
      connectRealtime(res.accessToken);
      setStatus("Đăng nhập thành công");
      setMode("home");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    }
  };

  const handleResendVerification = async () => {
    try {
      const res = await api.resendVerification(emailOrPhone);
      const otpDetail = res.otpSent
        ? ` Mã OTP đã gửi qua ${res.otpChannel === "sms" ? "SMS" : "Email"}${res.otpDestination ? ` tới ${res.otpDestination}` : ""}.`
        : ` Gửi OTP thật thất bại (${res.otpReason || "unknown"}${res.otpError ? `: ${res.otpError}` : ""}).`;
      setStatus(`${res.message}${otpDetail}${res.verificationCode ? ` OTP demo: ${res.verificationCode}` : ""}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gửi lại OTP thất bại");
    }
  };

  const handleProfile = async () => {
    try {
      const me = await api.me();
      setUserName(me.fullName);
      setProfileEmail(me.email || me.phone || "");
      setIsVerified(Boolean(me.isVerified));
      setCreatedAt(me.createdAt || "");
      setAvatarUrl(me.avatarUrl || "");
      setFullName(me.fullName);
      setDateOfBirth(me.dateOfBirth || "");
      setGender(me.gender || "");
      setStatus("Đã tải hồ sơ");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Lấy hồ sơ thất bại");
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setStatus("Đang cập nhật hồ sơ...");
      const res = await api.updateProfile({ 
        fullName: fullName || undefined,
        dateOfBirth: dateOfBirth || null,
        gender: (gender || null) as any,
        avatarUrl: avatarUrl || undefined
      });
      setUserName(res.user.fullName || "");
      setAvatarUrl(res.user.avatarUrl || "");
      setStatus(res.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Cập nhật hồ sơ thất bại");
    }
  };

  const handleChangePassword = async () => {
    try {
      const res = await api.changePassword({
        currentPassword,
        newPassword: newAuthPassword
      });
      authStore.clear();
      socket?.disconnect();
      setCurrentPassword("");
      setNewAuthPassword("");
      setUserName("");
      setMode("login");
      setStatus(`${res.message}. Đăng nhập lại để tiếp tục.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Đổi mật khẩu thất bại");
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Clear local auth state even if API logout fails.
    }

    authStore.clear();
    socket?.disconnect();
    setUserName("");
    setProfileEmail("");
    setIsVerified(false);
    setCreatedAt("");
    setMode("login");
    setStatus("Đã đăng xuất");
  };

  if (mode === "home") {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.homeContent}>
          <View style={styles.homeHeader}>
            <View>
              <Text style={styles.appTitle}>ZChat</Text>
              <Text style={styles.appSubtitle}>Nhắn tin thông minh</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.avatarBtn}
                onPress={() => setIsProfilePanelOpen(!isProfilePanelOpen)}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{userName?.charAt(0)?.toUpperCase() || "U"}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>Thoát</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionBtn}>
              <Text style={styles.quickActionText}>+ Cuộc trò chuyện mới</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn}>
              <Text style={styles.quickActionText}>Danh bạ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn}>
              <Text style={styles.quickActionText}>Tạo nhóm</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm cuộc trò chuyện..."
            placeholderTextColor="#9ca3af"
          />

          <View style={styles.threadsList}>
            {["Nhóm CNM", "Gia đình", "Bạn bè", "Lớp K8", "Dự án ZChat"].map((thread) => (
              <TouchableOpacity key={thread} style={styles.threadItem}>
                <View style={styles.threadContent}>
                  <Text style={styles.threadTitle}>{thread}</Text>
                  <Text style={styles.threadSubtitle}>Tin nhắn gần nhất sẽ hiển thị tại đây.</Text>
                </View>
                <View style={styles.threadBadge}>
                  <Text style={styles.threadBadgeText}>Mới</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {isProfilePanelOpen && (
            <View style={styles.profilePanel}>
              <Text style={styles.profileTitle}>Hồ sơ cá nhân</Text>
              <View style={styles.profileInfo}>
                <Text style={styles.profileLabel}>Email/SĐT: {profileEmail}</Text>
                <Text style={styles.profileLabel}>Xác thực: {isVerified ? "✓ Đã" : "✗ Chưa"}</Text>
                <Text style={styles.profileLabel}>Ngày tạo: {createdAt || "N/A"}</Text>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Họ tên"
                placeholderTextColor="#9ca3af"
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                style={styles.input}
                placeholder="Ngày sinh (YYYY-MM-DD)"
                placeholderTextColor="#9ca3af"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
              />
              <TextInput
                style={styles.input}
                placeholder="Giới tính (male/female/other)"
                placeholderTextColor="#9ca3af"
                value={gender}
                onChangeText={setGender}
              />
              <TextInput
                style={styles.input}
                placeholder="Avatar URL"
                placeholderTextColor="#9ca3af"
                value={avatarUrl}
                onChangeText={setAvatarUrl}
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleUpdateProfile}>
                <Text style={styles.primaryText}>Cập nhật hồ sơ</Text>
              </TouchableOpacity>

              <Text style={styles.passwordTitle}>Đổi mật khẩu</Text>
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu hiện tại"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu mới"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={newAuthPassword}
                onChangeText={setNewAuthPassword}
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleChangePassword}>
                <Text style={styles.secondaryText}>Đổi mật khẩu</Text>
              </TouchableOpacity>
            </View>
          )}

          {status && <Text style={styles.status}>{status}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.authContent}>
        <View style={styles.cardForm}>
          <Text style={styles.formTitle}>{modeTitle}</Text>
          <Text style={styles.formStatus}>{status}</Text>

          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === "login" && styles.segmentBtnActive]}
              onPress={() => setMode("login")}
            >
              <Text style={styles.segmentText}>Đăng nhập</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === "register" && styles.segmentBtnActive]}
              onPress={() => setMode("register")}
            >
              <Text style={styles.segmentText}>Đăng ký</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email hoặc số điện thoại"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            value={emailOrPhone}
            onChangeText={setEmailOrPhone}
          />

          {mode === "register" && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Họ tên (không bắt buộc)"
                placeholderTextColor="#9ca3af"
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                style={styles.input}
                placeholder="Ngày sinh (không bắt buộc)"
                placeholderTextColor="#9ca3af"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
              />
              <TextInput
                style={styles.input}
                placeholder="Giới tính (không bắt buộc)"
                placeholderTextColor="#9ca3af"
                value={gender}
                onChangeText={setGender}
              />
            </>
          )}

          {(mode === "login" || mode === "register") && (
            <TextInput
              style={styles.input}
              placeholder="Mật khẩu"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          )}

          {mode === "verify" && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Mã OTP"
                placeholderTextColor="#9ca3af"
                value={code}
                onChangeText={setCode}
              />
            </>
          )}

          {mode === "forgot" && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Mã đặt lại"
                placeholderTextColor="#9ca3af"
                value={code}
                onChangeText={setCode}
              />
            </>
          )}

          {mode === "reset" && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Mã đặt lại"
                placeholderTextColor="#9ca3af"
                value={code}
                onChangeText={setCode}
              />
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu mới"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit}>
            <Text style={styles.primaryText}>{modeTitle}</Text>
          </TouchableOpacity>

          {mode === "verify" && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleResendVerification}>
              <Text style={styles.secondaryText}>Gửi lại OTP</Text>
            </TouchableOpacity>
          )}

          {mode === "login" && (
            <TouchableOpacity onPress={() => setMode("forgot")}>
              <Text style={styles.linkText}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          )}

          {mode === "forgot" && (
            <TouchableOpacity onPress={() => setMode("reset")}>
              <Text style={styles.linkText}>Tôi đã có mã đặt lại</Text>
            </TouchableOpacity>
          )}

          {(mode === "forgot" || mode === "reset" || mode === "verify") && (
            <TouchableOpacity onPress={() => setMode("login")}>
              <Text style={styles.linkText}>Quay về đăng nhập</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  authContent: {
    padding: 16,
    justifyContent: "center",
    minHeight: "100%"
  },
  homeContent: {
    padding: 16,
    paddingBottom: 100
  },
  cardForm: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 20,
    gap: 12
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#114b2c",
    marginBottom: 8
  },
  formStatus: {
    fontSize: 14,
    color: "#ef4444",
    marginBottom: 12,
    fontWeight: "500"
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 16
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 10
  },
  segmentBtnActive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb"
  },
  segmentText: {
    color: "#1f2937",
    fontWeight: "600",
    fontSize: 13
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10
  },
  primaryBtn: {
    backgroundColor: "#1f6f3f",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#1f6f3f",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10
  },
  secondaryText: {
    color: "#1f6f3f",
    fontWeight: "600",
    fontSize: 14
  },
  linkText: {
    color: "#1f6f3f",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    textDecorationLine: "underline"
  },
  // Home screen styles
  homeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb"
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#114b2c"
  },
  appSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#1f6f3f",
    overflow: "hidden"
  },
  avatar: {
    width: "100%",
    height: "100%"
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center"
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f6f3f"
  },
  logoutBtn: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  logoutBtnText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16
  },
  quickActionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff"
  },
  quickActionText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500"
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: "#ffffff"
  },
  threadsList: {
    gap: 10,
    marginBottom: 16
  },
  threadItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#ffffff"
  },
  threadContent: {
    flex: 1
  },
  threadTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4
  },
  threadSubtitle: {
    fontSize: 12,
    color: "#6b7280"
  },
  threadBadge: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  threadBadgeText: {
    fontSize: 11,
    color: "#1f6f3f",
    fontWeight: "600"
  },
  profilePanel: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 16,
    marginTop: 16,
    gap: 12
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#114b2c",
    marginBottom: 8
  },
  profileInfo: {
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 12
  },
  profileLabel: {
    fontSize: 13,
    color: "#1f6f3f"
  },
  passwordTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#114b2c",
    marginTop: 12,
    marginBottom: 8
  },
  status: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginTop: 16,
    paddingTop: 12,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500"
  }
});
