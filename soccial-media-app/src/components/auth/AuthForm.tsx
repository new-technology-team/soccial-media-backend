import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { api } from "../../lib/api";
import { authStore } from "../../lib/auth";
import type { AuthUser } from "../../types";

type AuthMode = "login" | "register" | "verify" | "forgot" | "reset";

interface AuthFormProps {
  onLogin: (user: AuthUser) => void;
}

export function AuthForm({ onLogin }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetForms = () => {
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
    setCode("");
    setNewPassword("");
  };

  const handleLogin = async () => {
    if (!emailOrPhone || !password) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.login({ emailOrPhone, password });
      await authStore.setTokens({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!emailOrPhone || !password) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu không khớp");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      // Backend registers and returns tokens directly (no OTP)
      await api.register({
        emailOrPhone,
        password,
        fullName: fullName || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
      });
      // Auto-login after successful registration
      const res = await api.login({ emailOrPhone, password });
      await authStore.setTokens({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code) {
      setError("Vui lòng nhập mã OTP");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.verifyRegistration({ emailOrPhone, code });
      await authStore.setTokens({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác thực thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!emailOrPhone) {
      setError("Vui lòng nhập email hoặc số điện thoại");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.forgotPassword(emailOrPhone);
      setSuccess(
        res.message + (res.resetCode ? ` (Demo: ${res.resetCode})` : ""),
      );
      if (res.resetCode) setCode(res.resetCode);
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi yêu cầu thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (!code || !newPassword) {
      setError("Vui lòng nhập mã và mật khẩu mới");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.resetPassword({ emailOrPhone, code, newPassword });
      setSuccess("Đặt lại mật khẩu thành công");
      setTimeout(() => {
        setMode("login");
        resetForms();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đặt lại thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const modeTitle: Record<AuthMode, string> = {
    login: "Đăng nhập",
    register: "Đăng ký",
    verify: "Xác thực OTP",
    forgot: "Quên mật khẩu",
    reset: "Đặt lại mật khẩu",
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ minHeight: "100%" }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Brand Header */}
      <View className="bg-primary px-4 pt-12 pb-6">
        <Text className="text-white text-4xl font-extrabold tracking-tight">
          ZChat
        </Text>
        <Text className="text-white/80 text-sm mt-1">
          Kết nối mọi lúc, mọi nơi
        </Text>
      </View>

      <View className="px-4 py-6 flex-1">
        {/* Mode Tabs */}
        {mode === "login" && (
          <View className="flex-row mb-6 bg-surface-secondary rounded-xl p-1">
            {(["login", "register"] as AuthMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                className={`flex-1 py-2.5 rounded-lg ${mode === m ? "bg-surface shadow-sm" : "bg-transparent"}`}
                onPress={() => {
                  setMode(m);
                  resetForms();
                }}
              >
                <Text className="text-center text-sm font-semibold text-foreground">
                  {m === "login" ? "Đăng nhập" : "Đăng ký"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text className="text-2xl font-extrabold text-foreground mb-1 tracking-tight">
          {modeTitle[mode]}
        </Text>
        <Text className="text-sm text-muted-foreground mb-6">
          Chào mừng bạn quay trở lại
        </Text>

        {/* Error / Success */}
        {error ? (
          <View className="bg-red-50 border border-[#fecaca] rounded-xl px-4 py-3 mb-3">
            <Text className="text-danger text-sm font-medium">{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View className="bg-green-50 border border-[#bbf7d0] rounded-xl px-4 py-3 mb-3">
            <Text className="text-success text-sm font-medium">{success}</Text>
          </View>
        ) : null}

        {/* ── LOGIN ── */}
        {mode === "login" && (
          <View>
            <Input
              icon="📧"
              placeholder="Email hoặc số điện thoại"
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              icon="🔒"
              placeholder="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              className="self-end mb-4"
              onPress={() => {
                setMode("forgot");
                resetForms();
              }}
            >
              <Text className="text-primary font-semibold text-sm">
                Quên mật khẩu?
              </Text>
            </TouchableOpacity>
            <Button
              title={isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
              onPress={handleLogin}
              loading={isLoading}
            />
          </View>
        )}

        {/* ── REGISTER ── */}
        {mode === "register" && (
          <View>
            <Input
              icon="👤"
              placeholder="Họ và tên"
              value={fullName}
              onChangeText={setFullName}
            />
            <Input
              icon="📧"
              placeholder="Email hoặc số điện thoại"
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  placeholder="Ngày sinh (YYYY-MM-DD)"
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                />
              </View>
              <View className="flex-1">
                <Input
                  placeholder="Giới tính"
                  value={gender}
                  onChangeText={setGender}
                />
              </View>
            </View>
            <Input
              icon="🔒"
              placeholder="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Input
              icon="🔐"
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <Button
              title={isLoading ? "Đang đăng ký..." : "Đăng ký"}
              onPress={handleRegister}
              loading={isLoading}
            />
            <View className="flex-row justify-center mt-4">
              <Text className="text-muted-foreground text-sm">
                Đã có tài khoản?{" "}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setMode("login");
                  resetForms();
                }}
              >
                <Text className="text-primary font-semibold text-sm">
                  Đăng nhập
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── VERIFY ── */}
        {mode === "verify" && (
          <View>
            <Text className="text-sm text-muted-foreground mb-6">
              Nhập mã OTP đã gửi tới {emailOrPhone}
            </Text>
            <Input
              placeholder="Mã OTP 6 số"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Button
              title={isLoading ? "Đang xác thực..." : "Xác thực"}
              onPress={handleVerify}
              loading={isLoading}
            />
            <View className="flex-row justify-center mt-4">
              <TouchableOpacity onPress={() => setMode("login")}>
                <Text className="text-primary font-semibold text-sm">
                  Quay về đăng nhập
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── FORGOT ── */}
        {mode === "forgot" && (
          <View>
            <Text className="text-sm text-muted-foreground mb-6">
              Nhập email hoặc số điện thoại để nhận mã đặt lại
            </Text>
            <Input
              icon="📧"
              placeholder="Email hoặc số điện thoại"
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button
              title={isLoading ? "Đang gửi..." : "Gửi mã"}
              onPress={handleForgot}
              loading={isLoading}
            />
            <View className="flex-row justify-center mt-4">
              <TouchableOpacity
                onPress={() => {
                  setMode("login");
                  resetForms();
                }}
              >
                <Text className="text-primary font-semibold text-sm">
                  Quay về đăng nhập
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── RESET ── */}
        {mode === "reset" && (
          <View>
            <Text className="text-sm text-muted-foreground mb-6">
              Nhập mã và mật khẩu mới
            </Text>
            <Input
              placeholder="Mã đặt lại"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
            <Input
              placeholder="Mật khẩu mới"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <Button
              title={isLoading ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
              onPress={handleReset}
              loading={isLoading}
            />
            <View className="flex-row justify-center mt-4">
              <TouchableOpacity
                onPress={() => {
                  setMode("login");
                  resetForms();
                }}
              >
                <Text className="text-primary font-semibold text-sm">
                  Quay về đăng nhập
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Demo hint */}
        {mode === "login" && (
          <View className="mt-6 bg-blue-50 rounded-xl px-4 py-3 border border-blue-200">
            <Text className="text-primary font-semibold text-xs">
              💡 Demo mode
            </Text>
            <Text className="text-muted-foreground text-xs mt-1">
              Trong môi trường dev, OTP hiển thị trực tiếp. Không cần check
              email.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
