"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Shield, Users } from "lucide-react";
import { api } from "@/api/client";
import { useAuthStore } from "@/contexts/auth-store";
import styles from "./page.module.css";

type Settings = {
  privacyLastSeen: boolean;
  privacyProfilePhoto: boolean;
  allowFriendRequests: boolean;
  notificationMessages: boolean;
  notificationCalls: boolean;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeSection, setActiveSection] = useState<
    "security" | "privacy" | "access"
  >("security");
  const [settings, setSettings] = useState<Settings>({
    privacyLastSeen: false,
    privacyProfilePhoto: false,
    allowFriendRequests: true,
    notificationMessages: true,
    notificationCalls: true,
  });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    old: "",
    new: "",
    confirm: "",
  });

  useEffect(() => {
    if (!token) {
      navigate("/auth/login");
      return;
    }

    loadSettings();
  }, [token, navigate]);

  const loadSettings = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await api.getSettings(token);
      setSettings(response.settings);
    } catch (err) {
      console.error("Failed to load settings", err);
      setError("Không thể tải cài đặt");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (passwordForm.new !== passwordForm.confirm) {
      setError("Mật khẩu mới không khớp");
      return;
    }
    if (passwordForm.new.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(token, {
        oldPassword: passwordForm.old,
        newPassword: passwordForm.new,
      });
      setSuccess("Đã đổi mật khẩu thành công");
      setPasswordForm({ old: "", new: "", confirm: "" });
      setShowChangePassword(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi mật khẩu");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const response = await api.saveSettings(token, settings);
      setSettings(response.settings);
      setSuccess("Đã cập nhật cài đặt thành công");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu cài đặt");
    } finally {
      setSaving(false);
    }
  };

  if (!token || loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-lg w-48 shimmer" />
          <div className="h-4 bg-muted rounded-lg w-72 shimmer" />
          <div className="h-32 bg-muted rounded-2xl shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <header>
        <h1 className="text-xl font-bold">Cài đặt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Bảo mật và quyền riêng tư
        </p>
      </header>

      {/* Messages */}
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          {success}
        </div>
      )}

      {/* Layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar nav */}
        <nav className="lg:w-48 shrink-0 flex lg:flex-col gap-1">
          <button
            type="button"
            onClick={() => setActiveSection("security")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              activeSection === "security"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
            }`}
          >
            <Shield size={16} />
            Bảo mật
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("privacy")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              activeSection === "privacy"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
            }`}
          >
            <Users size={16} />
            Riêng tư
          </button>

          <div className="border-t border-border/60 pt-2 mt-2">
            <Link
              to="/feed"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all"
            >
              <ArrowLeft size={16} />
              Quay lại
            </Link>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {activeSection === "security" && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold">Mật khẩu</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Nên đổi mật khẩu định kỳ 6 tháng/lần.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowChangePassword(!showChangePassword)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-accent/10 transition-colors"
              >
                {showChangePassword ? "Hủy" : "Cập nhật mật khẩu"}
              </button>

              {showChangePassword && (
                <form
                  onSubmit={handleChangePassword}
                  className="space-y-3 pt-2 border-t border-border/60"
                >
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Mật khẩu hiện tại
                    </label>
                    <input
                      type="password"
                      value={passwordForm.old}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          old: e.target.value,
                        })
                      }
                      required
                      className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border text-sm outline-none focus:border-primary/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Mật khẩu mới
                    </label>
                    <input
                      type="password"
                      value={passwordForm.new}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          new: e.target.value,
                        })
                      }
                      required
                      className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border text-sm outline-none focus:border-primary/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Xác nhận mật khẩu mới
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirm: e.target.value,
                        })
                      }
                      required
                      className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border text-sm outline-none focus:border-primary/40 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {saving ? "Đang lưu..." : "Lưu mật khẩu mới"}
                  </button>
                </form>
              )}
            </div>
          )}

          {activeSection === "privacy" && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold">Quyền riêng tư</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Kiểm soát ai có thể xem thông tin của bạn.
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.privacyLastSeen}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        privacyLastSeen: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span>
                    <span className="text-sm font-medium block">
                      Ẩn trạng thái 'Online'
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Người khác không thể biết bạn đang online
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.privacyProfilePhoto}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        privacyProfilePhoto: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span>
                    <span className="text-sm font-medium block">
                      Ẩn ảnh hồ sơ
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Chỉ bạn bè mới thấy ảnh hồ sơ
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowFriendRequests}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        allowFriendRequests: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span>
                    <span className="text-sm font-medium block">
                      Cho phép kết bạn
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Mọi người có thể gửi lời mời kết bạn
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationMessages}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notificationMessages: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span>
                    <span className="text-sm font-medium block">
                      Thông báo tin nhắn
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Nhận thông báo khi có tin nhắn mới
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationCalls}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notificationCalls: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span>
                    <span className="text-sm font-medium block">
                      Thông báo cuộc gọi
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Nhận thông báo khi có cuộc gọi đến
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Save actions */}
          <div className="flex items-center gap-3 pt-2">
            <Link
              to="/feed"
              className="inline-flex items-center px-5 py-2 rounded-xl text-sm font-medium border border-border hover:bg-accent/10 transition-colors"
            >
              Hủy thay đổi
            </Link>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {saving ? "Đang lưu..." : "Lưu cài đặt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
