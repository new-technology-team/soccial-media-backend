import { FormEvent, useState } from "react";
import { AuthForm } from "../components/auth/AuthForm";
import { api } from "../lib/api";
import { authStorage } from "../lib/auth";

export type Mode = "login" | "register" | "verify" | "forgot" | "reset";

type Props = {
  onLoginSuccess: () => Promise<void>;
  onSwitchToVerify: () => void;
};

export function AuthPage({ onLoginSuccess, onSwitchToVerify }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);
    try {
      if (mode === "register") {
        if (avatarFile) {
          setMessage(
            "Ảnh đại diện có thể thêm sau khi đăng nhập trong Hồ sơ cá nhân.",
          );
        }
        const data = await api.register({
          emailOrPhone,
          password,
          fullName: fullName || undefined,
          dateOfBirth: dateOfBirth || undefined,
          gender: (gender || undefined) as
            | "male"
            | "female"
            | "other"
            | undefined,
        });
        const channelMessage = data.otpSent
          ? `Mã OTP đã gửi qua ${data.otpChannel === "sms" ? "SMS" : "Email"}${data.otpDestination ? ` tới ${data.otpDestination}` : ""}.`
          : `Gửi OTP thất bại (${data.otpReason || "unknown"}).`;
        setMessage(
          `${data.message} ${channelMessage}`,
        );
        setMode("verify");
      } else if (mode === "verify") {
        const data = await api.verifyRegistration({ emailOrPhone, code });
        authStorage.setTokens(data.access_token, data.refresh_token);
        setMessage("Xác thực OTP thành công.");
        setMode("login");
        await onLoginSuccess();
      } else if (mode === "forgot") {
        const data = await api.forgotPassword(emailOrPhone);
        const channelMessage = data.otpSent
          ? `Mã đặt lại đã gửi qua ${data.otpChannel === "sms" ? "SMS" : "Email"}${data.otpDestination ? ` tới ${data.otpDestination}` : ""}.`
          : `Gửi mã thất bại (${data.otpReason || "unknown"}).`;
        setMessage(`${data.message} ${channelMessage}`);
        setMode("reset");
      } else if (mode === "reset") {
        const data = await api.resetPassword({
          emailOrPhone,
          code,
          newPassword,
        });
        setMessage(data.message);
        setMode("login");
      } else {
        const data = await api.login({ emailOrPhone, password });
        authStorage.setTokens(data.access_token, data.refresh_token);
        await onLoginSuccess();
        setMessage("Đăng nhập thành công.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Đã xảy ra lỗi";
      setMessage(errorMessage);
      if (
        mode === "login" &&
        errorMessage.toLowerCase().includes("chưa được xác thực")
      ) {
        setMode("verify");
        onSwitchToVerify();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onResendVerification = async () => {
    try {
      setIsLoading(true);
      const data = await api.resendVerification(emailOrPhone);
      const channelMessage = data.otpSent
        ? `Mã OTP đã gửi qua ${data.otpChannel === "sms" ? "SMS" : "Email"}${data.otpDestination ? ` tới ${data.otpDestination}` : ""}.`
        : `Chưa có cấu hình OTP thật (${data.otpError || data.otpReason || "unknown"}), vui lòng dùng mã OTP demo.`;
      setMessage(`${data.message} ${channelMessage}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 p-4 md:p-8">
      <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-brand-100">
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-brand-50 p-1">
          <button
            className={`rounded-lg px-4 py-2 text-sm ${mode === "login" ? "bg-white font-semibold" : ""}`}
            onClick={() => setMode("login")}
            type="button"
          >
            Đăng nhập
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm ${mode === "register" ? "bg-white font-semibold" : ""}`}
            onClick={() => setMode("register")}
            type="button"
          >
            Đăng ký
          </button>
        </div>

        <AuthForm
          mode={mode}
          emailOrPhone={emailOrPhone}
          setEmailOrPhone={setEmailOrPhone}
          password={password}
          setPassword={setPassword}
          fullName={fullName}
          setFullName={setFullName}
          dateOfBirth={dateOfBirth}
          setDateOfBirth={setDateOfBirth}
          gender={gender}
          setGender={setGender}
          avatarFile={avatarFile}
          setAvatarFile={setAvatarFile}
          code={code}
          setCode={setCode}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          isLoading={isLoading}
          onSubmit={onSubmit}
          onResendVerification={onResendVerification}
          onSwitchMode={setMode}
          message={message}
        />
      </div>
    </main>
  );
}
