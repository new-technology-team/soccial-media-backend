import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./lib/api";
import { authStorage } from "./lib/auth";
import { connectSocket } from "./lib/socket";
import {
  Bell,
  FileText,
  Image as ImageIcon,
  Info,
  MessageCircle,
  Music,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  Smile,
  Users,
  Video
} from "lucide-react";
import type {
  AppNotification,
  AuthUser,
  ChatMessage,
  Conversation,
  FriendItem,
  UserSettings
} from "./types";
import type { Socket } from "socket.io-client";

type Mode = "login" | "register" | "verify" | "forgot" | "reset";
type DashboardTab = "chat" | "friends" | "notifications" | "settings";

type Gender = "male" | "female" | "other";

function App() {
  const socketRef = useRef<Socket | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("chat");
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isConversationInfoOpen, setIsConversationInfoOpen] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newAuthPassword, setNewAuthPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [messageType, setMessageType] = useState<"text" | "image" | "video" | "audio" | "file" | "sticker">("text");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [typingState, setTypingState] = useState<Record<number, string>>({});
  const typingTimeoutRef = useRef<number | null>(null);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [userSearchKeyword, setUserSearchKeyword] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<Array<{ id: number; full_name: string; email?: string; phone?: string; avatar_url?: string }>>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [directUserIdInput, setDirectUserIdInput] = useState("");
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupMemberIdsInput, setGroupMemberIdsInput] = useState("");
  const [memberUserIdInput, setMemberUserIdInput] = useState("");
  const [toggleAdminUserIdInput, setToggleAdminUserIdInput] = useState("");
  const [removeMemberUserIdInput, setRemoveMemberUserIdInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Record<number, boolean>>({});

  const title = useMemo(() => {
    switch (mode) {
      case "register":
        return "Đăng ký";
      case "verify":
        return "Xác thực OTP";
      case "forgot":
        return "Quên mật khẩu";
      case "reset":
        return "Đặt lại mật khẩu";
      default:
        return "Đăng nhập";
    }
  }, [mode]);

  const saveAuth = (payload: { accessToken: string; refreshToken: string }) => {
    authStorage.setTokens(payload.accessToken, payload.refreshToken);
  };

  const loadConversations = async () => {
    const data = await api.listConversations();
    setConversations(data.conversations);

    if (!selectedConversation && data.conversations[0]) {
      setSelectedConversation(data.conversations[0]);
    }

    return data.conversations;
  };

  const loadFriends = async () => {
    const data = await api.listFriends();
    setFriends(data.friends);
  };

  const loadNotifications = async () => {
    const data = await api.listNotifications();
    setNotifications(data.notifications);
  };

  const loadSettings = async () => {
    const data = await api.getSettings();
    setSettings(data.settings);
  };

  const loadDashboardData = async () => {
    await Promise.all([
      loadConversations(),
      loadFriends(),
      loadNotifications(),
      loadSettings()
    ]);
  };

  const loadMessages = async (conversationId: number) => {
    const data = await api.getConversationMessages(conversationId, 50);
    setMessages(data.messages);
    await api.markSeen(conversationId);
  };

  const loadProfile = async () => {
    try {
      const me = await api.me();
      setProfile(me);
      setFullName(me.fullName || "");
      setAvatarUrl(me.avatarUrl || "");
      setDateOfBirth(me.dateOfBirth || "");
      setGender((me.gender as Gender) || "");
    } catch {
      authStorage.clear();
      setProfile(null);
    }
  };

  useEffect(() => {
    if (authStorage.getAccessToken()) {
      loadProfile();
      loadDashboardData().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;

    if (dashboardTab === "chat") {
      loadConversations().catch(() => undefined);
      return;
    }

    if (dashboardTab === "friends") {
      loadFriends().catch(() => undefined);
      return;
    }

    if (dashboardTab === "notifications") {
      loadNotifications().catch(() => undefined);
      return;
    }

    if (dashboardTab === "settings") {
      loadSettings().catch(() => undefined);
    }
  }, [dashboardTab, profile?.id]);

  useEffect(() => {
    if (!profile) return;
    const token = authStorage.getAccessToken();
    if (!token) return;

    const socket = connectSocket(token);
    socketRef.current = socket;

    socket.on("message:new", (payload: ChatMessage) => {
      setConversations((prev) => prev.map((item) => (item.id === payload.conversationId ? { ...item, unreadCount: item.id === selectedConversation?.id ? 0 : item.unreadCount + 1, lastMessage: { id: payload.id, senderId: payload.senderId, type: payload.type, text: payload.text, mediaUrl: payload.mediaUrl, createdAt: payload.createdAt } } : item)));
      if (selectedConversation?.id === payload.conversationId) {
        setMessages((prev) => [...prev, payload]);
      }
    });

    socket.on("conversation:typing", (payload: { conversationId: number; userId: number; isTyping: boolean }) => {
      if (payload.userId === profile.id) return;
      if (!payload.isTyping) {
        setTypingState((prev) => {
          const next = { ...prev };
          delete next[payload.conversationId];
          return next;
        });
        return;
      }

      setTypingState((prev) => ({ ...prev, [payload.conversationId]: `User ${payload.userId} đang nhập...` }));
    });

    socket.on("presence:online", (payload: { userId: number; isOnline: boolean }) => {
      setOnlineUsers((prev) => ({ ...prev, [payload.userId]: payload.isOnline }));
    });

    socket.on("notification:new", () => {
      loadNotifications().catch(() => undefined);
    });

    socket.on("friend:request", () => {
      loadFriends().catch(() => undefined);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [profile, selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation) return;
    socketRef.current?.emit("join-conversation", selectedConversation.id);
    loadMessages(selectedConversation.id).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Không thể tải tin nhắn");
    });
  }, [selectedConversation?.id]);

  useEffect(() => {
    setIsSearchOpen(false);
    setIsConversationInfoOpen(false);
  }, [selectedConversation?.id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      if (mode === "register") {
        if (avatarFile) {
          setMessage("Ảnh đại diện có thể thêm sau khi đăng nhập trong Hồ sơ cá nhân.");
        }

        const data = await api.register({
          emailOrPhone,
          password,
          fullName: fullName || undefined,
          dateOfBirth: dateOfBirth || undefined,
          gender: (gender || undefined) as Gender | undefined
        });

        const channelMessage = data.otpSent
          ? `Mã OTP đã gửi qua ${data.otpChannel === "sms" ? "SMS" : "Email"}${data.otpDestination ? ` tới ${data.otpDestination}` : ""}.`
          : `Gửi OTP thất bại (${data.otpReason || "unknown"}${data.otpError ? `: ${data.otpError}` : ""}).`;

        setMessage(`${data.message} ${channelMessage}${data.verificationCode ? ` (OTP demo: ${data.verificationCode})` : ""}`);
        setMode("verify");
      } else if (mode === "verify") {
        const data = await api.verifyRegistration({ emailOrPhone, code });
        saveAuth(data);
        await loadProfile();
        await loadDashboardData();
        setMessage("Xác thực OTP thành công.");
      } else if (mode === "forgot") {
        const data = await api.forgotPassword(emailOrPhone);
        const channelMessage = data.otpSent
          ? `Mã đặt lại đã gửi qua ${data.otpChannel === "sms" ? "SMS" : "Email"}${data.otpDestination ? ` tới ${data.otpDestination}` : ""}.`
          : `Gửi mã thất bại (${data.otpReason || "unknown"}${data.otpError ? `: ${data.otpError}` : ""}).`;
        setMessage(`${data.message} ${channelMessage}${data.resetCode ? ` (Mã demo: ${data.resetCode})` : ""}`);
        setMode("reset");
      } else if (mode === "reset") {
        const data = await api.resetPassword({ emailOrPhone, code, newPassword });
        setMessage(data.message);
        setMode("login");
      } else {
        const data = await api.login({ emailOrPhone, password });
        saveAuth(data);
        await loadProfile();
        await loadDashboardData();
        setMessage("Đăng nhập thành công.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Đã xảy ra lỗi";
      setMessage(errorMessage);

      if (mode === "login" && errorMessage.toLowerCase().includes("chưa được xác thực")) {
        setMode("verify");
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
        : `Chưa có cấu hình gửi OTP thật (${data.otpError || data.otpReason || "unknown"}), vui lòng dùng mã OTP demo bên dưới.`;
      setMessage(`${data.message} ${channelMessage}${data.verificationCode ? ` (OTP demo: ${data.verificationCode})` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    } finally {
      setIsLoading(false);
    }
  };

  const onUpdateProfile = async () => {
    try {
      setIsLoading(true);

      let uploadedAvatarUrl = avatarUrl;
      let avatarUploadWarning = "";
      if (avatarFile) {
        try {
          setIsUploadingAvatar(true);
          const uploadInfo = await api.getAvatarUploadUrl({
            fileName: avatarFile.name,
            contentType: avatarFile.type || "application/octet-stream"
          });
          try {
            await api.uploadAvatarToSignedUrl(uploadInfo.signedUploadUrl, avatarFile);
            uploadedAvatarUrl = uploadInfo.mediaUrl || uploadInfo.signedReadUrl;
          } catch (_signedUrlError) {
            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(String(reader.result || ""));
              reader.onerror = () => reject(new Error("Không thể đọc file ảnh"));
              reader.readAsDataURL(avatarFile);
            });

            const fallback = await api.uploadAvatarBase64({
              fileName: avatarFile.name,
              contentType: avatarFile.type || "application/octet-stream",
              base64Data
            });

            uploadedAvatarUrl = fallback.mediaUrl || fallback.signedReadUrl;
            avatarUploadWarning = "Đã dùng chế độ upload dự phòng qua server để lưu ảnh lên S3.";
          }
        } catch (uploadError) {
          avatarUploadWarning =
            uploadError instanceof Error
              ? `Không thể tải ảnh đại diện: ${uploadError.message}`
              : "Không thể tải ảnh đại diện.";
        } finally {
          setIsUploadingAvatar(false);
        }
      }

      const data = await api.updateProfile({
        fullName: fullName || undefined,
        avatarUrl: uploadedAvatarUrl || undefined,
        dateOfBirth: dateOfBirth || null,
        gender: (gender || null) as Gender | null
      });
      await loadProfile();
      setAvatarFile(null);
      setMessage(avatarUploadWarning ? `${data.message}. ${avatarUploadWarning}` : data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cập nhật hồ sơ thất bại");
    } finally {
      setIsLoading(false);
      setIsUploadingAvatar(false);
    }
  };

  const onChangePassword = async () => {
    try {
      setIsLoading(true);
      const data = await api.changePassword({ currentPassword, newPassword: newAuthPassword });
      setCurrentPassword("");
      setNewAuthPassword("");
      authStorage.clear();
      setProfile(null);
      setMode("login");
      setMessage(`${data.message}. Vui lòng đăng nhập lại.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Đổi mật khẩu thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const onLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Keep local logout behavior when API logout fails.
    }

    authStorage.clear();
    socketRef.current?.disconnect();
    setProfile(null);
    setIsProfilePanelOpen(false);
    setMode("login");
    setMessage("Đã đăng xuất");
  };

  const onMessageInputChange = (value: string) => {
    setMessageInput(value);
    if (!selectedConversation) return;

    socketRef.current?.emit("typing", {
      conversationId: selectedConversation.id,
      isTyping: true
    });

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      socketRef.current?.emit("typing", {
        conversationId: selectedConversation.id,
        isTyping: false
      });
    }, 1200);
  };

  const onSendMessage = async () => {
    if (!selectedConversation) {
      setMessage("Vui lòng chọn hội thoại");
      return;
    }

    try {
      setIsLoading(true);
      let mediaUrl: string | undefined;
      let fileName: string | undefined;
      let mimeType: string | undefined;
      let fileSize: number | undefined;

      if (chatFile) {
        const upload = await api.getMessageUploadUrl(selectedConversation.id, {
          fileName: chatFile.name,
          contentType: chatFile.type || "application/octet-stream"
        });
        await api.uploadMessageMediaToSignedUrl(upload.signedUploadUrl, chatFile);
        mediaUrl = upload.mediaUrl;
        fileName = chatFile.name;
        mimeType = chatFile.type;
        fileSize = chatFile.size;
      }

      const payload = {
        type: messageType,
        text: messageInput.trim() || undefined,
        mediaUrl,
        fileName,
        mimeType,
        fileSize,
        sticker: messageType === "sticker" ? messageInput.trim() : undefined
      };

      const result = await api.sendMessage(selectedConversation.id, payload);
      setMessages((prev) => [...prev, result.message]);
      setMessageInput("");
      setChatFile(null);
      setMessageType("text");
      await loadConversations();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gửi tin nhắn");
    } finally {
      setIsLoading(false);
    }
  };

  const onSearchMessages = async () => {
    try {
      if (!searchKeyword.trim()) {
        setSearchResults([]);
        return;
      }

      const data = await api.searchMessages(searchKeyword.trim());
      setSearchResults(data.messages);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tìm kiếm tin nhắn");
    }
  };

  const onCreateDirectConversation = async () => {
    try {
      const userId = Number(directUserIdInput);
      if (!userId) {
        setMessage("Nhập userId hợp lệ để tạo chat 1-1");
        return;
      }

      await api.createDirectConversation(userId);
      setDirectUserIdInput("");
      await loadConversations();
      setIsQuickCreateOpen(false);
      setMessage("Tạo hội thoại 1-1 thành công");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo hội thoại 1-1");
    }
  };

  const onCreateGroupConversation = async () => {
    try {
      const memberIds = groupMemberIdsInput
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item) && item > 0);

      if (!groupNameInput.trim() || !memberIds.length) {
        setMessage("Nhập tên nhóm và ít nhất 1 userId");
        return;
      }

      await api.createGroupConversation({
        name: groupNameInput.trim(),
        memberIds
      });

      setGroupNameInput("");
      setGroupMemberIdsInput("");
      await loadConversations();
      setIsQuickCreateOpen(false);
      setMessage("Tạo nhóm thành công");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo nhóm");
    }
  };

  const onAddMember = async () => {
    if (!selectedConversation) return;
    try {
      const userId = Number(memberUserIdInput);
      if (!userId) {
        setMessage("Nhập userId hợp lệ");
        return;
      }

      await api.addMember(selectedConversation.id, userId);
      setMemberUserIdInput("");
      await loadConversations();
      setMessage("Đã thêm thành viên");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể thêm thành viên");
    }
  };

  const onRemoveMember = async () => {
    if (!selectedConversation) return;
    try {
      const userId = Number(removeMemberUserIdInput);
      if (!userId) {
        setMessage("Nhập userId hợp lệ");
        return;
      }

      await api.removeMember(selectedConversation.id, userId);
      setRemoveMemberUserIdInput("");
      await loadConversations();
      setMessage("Đã xóa thành viên");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa thành viên");
    }
  };

  const onToggleAdmin = async (isAdmin: boolean) => {
    if (!selectedConversation) return;
    try {
      const userId = Number(toggleAdminUserIdInput);
      if (!userId) {
        setMessage("Nhập userId hợp lệ");
        return;
      }

      await api.updateAdmin(selectedConversation.id, userId, isAdmin);
      setToggleAdminUserIdInput("");
      await loadConversations();
      setMessage("Đã cập nhật quyền admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật admin");
    }
  };

  const onToggleConversationNotify = async () => {
    if (!selectedConversation) return;
    try {
      await api.toggleConversationNotifications(
        selectedConversation.id,
        !selectedConversation.notificationsEnabled
      );
      await loadConversations();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật cài đặt thông báo hội thoại");
    }
  };

  const onSearchUsers = async () => {
    try {
      if (!userSearchKeyword.trim()) {
        setUserSearchResults([]);
        return;
      }

      const data = await api.searchUsers(userSearchKeyword.trim());
      setUserSearchResults(data.users);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tìm kiếm user");
    }
  };

  const onRequestFriend = async (userId: number) => {
    try {
      await api.requestFriend(userId);
      await loadFriends();
      setMessage("Đã gửi lời mời kết bạn");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gửi lời mời kết bạn");
    }
  };

  const onStartChatWithUser = async (userId: number) => {
    try {
      await api.createDirectConversation(userId);
      const updated = await loadConversations();
      const matched = updated.find((item) =>
        item.type === "direct" && item.members.some((member) => member.userId === userId)
      );
      if (matched) {
        setSelectedConversation(matched);
      }
      setDashboardTab("chat");
      setMessage("Đã mở cuộc trò chuyện 1-1");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể mở cuộc trò chuyện");
    }
  };

  const onAcceptFriend = async (userId: number) => {
    try {
      await api.acceptFriend(userId);
      await loadFriends();
      setMessage("Đã chấp nhận lời mời kết bạn");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể chấp nhận kết bạn");
    }
  };

  const onRemoveFriend = async (userId: number) => {
    try {
      await api.removeFriend(userId);
      await loadFriends();
      setMessage("Đã xóa bạn");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa bạn");
    }
  };

  const onReadAllNotifications = async () => {
    try {
      await api.readAllNotifications();
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật thông báo");
    }
  };

  const onReadNotification = async (id: number) => {
    try {
      await api.readNotification(id);
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật thông báo");
    }
  };

  const onUpdateSettings = async (next: Partial<UserSettings>) => {
    try {
      const data = await api.updateSettings(next);
      setSettings(data.settings);
      setMessage(data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật cài đặt");
    }
  };

  const renderAuthFields = () => {
    if (mode === "verify") {
      return (
        <>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Email hoặc số điện thoại</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              type="text"
              placeholder="email@example.com hoặc 0912345678"
              value={emailOrPhone}
              onChange={(event) => setEmailOrPhone(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">Mã OTP</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              placeholder="Nhập mã OTP"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>
        </>
      );
    }

    if (mode === "forgot") {
      return (
        <div>
          <label className="mb-1 block text-sm text-slate-600">Email hoặc số điện thoại</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
            type="text"
            placeholder="email@example.com hoặc 0912345678"
            value={emailOrPhone}
            onChange={(event) => setEmailOrPhone(event.target.value)}
            required
          />
        </div>
      );
    }

    if (mode === "reset") {
      return (
        <>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Email hoặc số điện thoại</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              type="text"
              placeholder="email@example.com hoặc 0912345678"
              value={emailOrPhone}
              onChange={(event) => setEmailOrPhone(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Mã đặt lại</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              placeholder="Nhập mã đặt lại"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Mật khẩu mới</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              type="password"
              placeholder="Mật khẩu mới (6-72 ký tự)"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
        </>
      );
    }

    return (
      <>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Email hoặc số điện thoại</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
            type="text"
            placeholder="email@example.com hoặc 0912345678"
            value={emailOrPhone}
            onChange={(event) => setEmailOrPhone(event.target.value)}
            required
          />
        </div>

        {mode === "register" && (
          <>
            <div>
              <label className="mb-1 block text-sm text-slate-600">Họ tên (không bắt buộc)</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">Ngày sinh (không bắt buộc)</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
                type="date"
                aria-label="Ngày sinh"
                title="Ngày sinh"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">Giới tính (không bắt buộc)</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
                aria-label="Giới tính"
                title="Giới tính"
                value={gender}
                onChange={(event) => setGender(event.target.value as Gender | "")}
              >
                <option value="">Chưa chọn</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">Ảnh đại diện (thêm sau khi đăng nhập)</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
                type="file"
                accept="image/*"
                aria-label="Ảnh đại diện"
                title="Chọn ảnh đại diện"
                onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm text-slate-600">Mật khẩu</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
            type="password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
      </>
    );
  };

  const renderHome = () => (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl items-start gap-4">
        <section className="w-24 rounded-3xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
          <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Menu</h2>
          <div className="space-y-2">
            {[
              { key: "chat", label: "Chat", Icon: MessageCircle },
              { key: "friends", label: "Bạn bè", Icon: Users },
              { key: "notifications", label: "Thông báo", Icon: Bell },
              { key: "settings", label: "Cài đặt", Icon: Settings }
            ].map((item) => (
              <button
                key={item.key}
                className={`w-full rounded-xl px-2 py-2 text-center ${dashboardTab === item.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
                type="button"
                onClick={() => setDashboardTab(item.key as DashboardTab)}
                title={item.label}
              >
                <div className="flex justify-center"><item.Icon size={18} strokeWidth={2.25} /></div>
                <div className="mt-1 text-[10px] font-medium">{item.label}</div>
              </button>
            ))}
          </div>

        </section>

        <section className="flex-1 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
          <header className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">ZChat</h1>
              <p className="text-sm text-slate-600">Nhắn tin rõ ràng, dễ nhìn, thao tác nhanh</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="h-12 w-12 overflow-hidden rounded-full border-2 border-brand-200 transition hover:border-brand-400"
                type="button"
                onClick={() => setIsProfilePanelOpen((value) => !value)}
                title="Mở hồ sơ cá nhân"
              >
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-200 to-brand-300 text-sm font-bold text-brand-900">
                    {profile?.fullName?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
              </button>
              <button
                className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                type="button"
                onClick={onLogout}
              >
                Đăng xuất
              </button>
            </div>
          </header>

          {dashboardTab === "chat" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <aside className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Hội thoại</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{conversations.length}</span>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-auto">
                  {conversations.map((thread) => {
                    const threadName =
                      thread.type === "group"
                        ? thread.name || `Nhóm ${thread.id}`
                        : thread.members.find((m) => m.userId !== profile?.id)?.fullName || `Direct ${thread.id}`;

                    return (
                      <button
                        key={thread.id}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${selectedConversation?.id === thread.id ? "border-brand-400 bg-brand-50 shadow-sm" : "border-slate-200 bg-white hover:border-brand-200"}`}
                        type="button"
                        onClick={() => setSelectedConversation(thread)}
                      >
                        <div className="font-semibold text-slate-800">{threadName}</div>
                        <div className="text-xs text-slate-500">{thread.lastMessage?.text || thread.lastMessage?.type || "Chưa có tin nhắn"}</div>
                        {thread.unreadCount > 0 && <div className="mt-1 inline-block rounded-full bg-brand-600 px-2 py-0.5 text-[11px] text-white">{thread.unreadCount}</div>}
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="rounded-2xl border border-slate-100 bg-white p-3">
                {selectedConversation ? (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-800">Hội thoại #{selectedConversation.id}</h3>
                        <p className="text-xs text-slate-500">Nhắn tin văn bản, sticker, media và theo dõi trạng thái realtime</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="rounded-lg border border-slate-300 p-2 text-xs transition hover:border-brand-300" type="button" onClick={() => setIsQuickCreateOpen(true)} title="Tạo hội thoại">
                          <Plus size={16} />
                        </button>
                        <button
                          className={`rounded-lg border p-2 text-xs transition ${isSearchOpen ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 hover:border-brand-300"}`}
                          type="button"
                          title="Tìm kiếm tin nhắn"
                          onClick={() => setIsSearchOpen((prev) => !prev)}
                        >
                          <Search size={16} />
                        </button>
                        <button
                          className={`rounded-lg border p-2 text-xs transition ${isConversationInfoOpen ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 hover:border-brand-300"}`}
                          type="button"
                          title="Thông tin hội thoại / quản trị nhóm"
                          onClick={() => setIsConversationInfoOpen((prev) => !prev)}
                        >
                          <Info size={16} />
                        </button>
                        <button className="rounded-lg border border-slate-300 p-2 text-xs transition hover:border-brand-300" type="button" onClick={onToggleConversationNotify} title={selectedConversation.notificationsEnabled ? "Tắt thông báo" : "Bật thông báo"}>
                          <Bell size={16} />
                        </button>
                      </div>
                    </div>

                    {isSearchOpen && (
                      <div className="mb-3 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <input
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Tìm tin nhắn theo từ khóa"
                          value={searchKeyword}
                          onChange={(event) => setSearchKeyword(event.target.value)}
                        />
                        <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm" type="button" onClick={onSearchMessages}>Tìm</button>
                      </div>
                    )}

                    {searchResults.length > 0 && (
                      <div className="mb-3 max-h-28 overflow-auto rounded-xl bg-slate-50 p-2 text-xs text-slate-700">
                        {searchResults.slice(0, 8).map((item) => (
                          <div key={item.id}>#{item.id} {item.senderName}: {item.text || item.type}</div>
                        ))}
                      </div>
                    )}

                    <div className="mb-3 max-h-[360px] space-y-2 overflow-auto rounded-xl bg-slate-100 p-3">
                      {messages.map((item) => (
                        <div key={item.id} className={`flex ${item.senderId === profile?.id ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[15px] leading-6 shadow-sm ${item.senderId === profile?.id ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
                            <div className={`mb-1 text-[11px] ${item.senderId === profile?.id ? "text-brand-100" : "text-slate-500"}`}>{item.senderName}</div>
                            <div>
                              {item.type === "text" && (item.text || "")}
                              {item.type === "sticker" && <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-900"><Smile size={12} /> {item.meta?.sticker || "sticker"}</span>}
                              {item.type === "image" && <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-sky-900"><ImageIcon size={12} /> Ảnh</span>}
                              {item.type === "video" && <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-violet-900"><Video size={12} /> Video</span>}
                              {item.type === "audio" && <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-900"><Music size={12} /> Audio</span>}
                              {item.type === "file" && <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-orange-900"><FileText size={12} /> Tệp</span>}
                              {item.type !== "text" && item.text && <div className="mt-1 text-sm">{item.text}</div>}
                            </div>
                          {item.mediaUrl && (
                            <a className={`mt-1 block text-xs underline ${item.senderId === profile?.id ? "text-white" : "text-brand-700"}`} href={item.mediaUrl} target="_blank" rel="noreferrer">
                              Mở file đính kèm
                            </a>
                          )}
                          </div>
                        </div>
                      ))}
                      {typingState[selectedConversation.id] && <div className="text-xs text-brand-700">{typingState[selectedConversation.id]}</div>}
                    </div>

                    {isConversationInfoOpen && (
                      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <h4 className="mb-2 text-sm font-semibold text-slate-700">Thông tin hội thoại</h4>
                        <div className="mb-3 text-xs text-slate-600">
                          <div>ID: {selectedConversation.id}</div>
                          <div>Loại: {selectedConversation.type}</div>
                          <div>Thông báo: {selectedConversation.notificationsEnabled ? "Bật" : "Tắt"}</div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Add member userId" value={memberUserIdInput} onChange={(event) => setMemberUserIdInput(event.target.value)} />
                          <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm" type="button" onClick={onAddMember}>Thêm thành viên</button>
                          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Remove member userId" value={removeMemberUserIdInput} onChange={(event) => setRemoveMemberUserIdInput(event.target.value)} />
                          <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm" type="button" onClick={onRemoveMember}>Xóa thành viên</button>
                          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Toggle admin userId" value={toggleAdminUserIdInput} onChange={(event) => setToggleAdminUserIdInput(event.target.value)} />
                          <div className="flex gap-2">
                            <button className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" type="button" onClick={() => onToggleAdmin(true)}>Set admin</button>
                            <button className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" type="button" onClick={() => onToggleAdmin(false)}>Unset</button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-2">
                      <div className="mb-2 flex items-center gap-2">
                        {[
                          { type: "text", Icon: MessageCircle, title: "Tin nhắn văn bản" },
                          { type: "sticker", Icon: Smile, title: "Sticker" },
                          { type: "image", Icon: ImageIcon, title: "Ảnh" },
                          { type: "video", Icon: Video, title: "Video" },
                          { type: "audio", Icon: Music, title: "Audio" },
                          { type: "file", Icon: FileText, title: "Tệp" }
                        ].map((item) => (
                          <button
                            key={item.type}
                            className={`h-8 w-8 rounded-lg text-sm ${messageType === item.type ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
                            type="button"
                            title={item.title}
                            onClick={() => {
                              setMessageType(item.type as typeof messageType);
                              if (item.type === "text") {
                                setChatFile(null);
                              }
                            }}
                          >
                            <item.Icon size={16} />
                          </button>
                        ))}
                        <button
                          className="h-8 rounded-lg bg-slate-100 px-2 text-xs text-slate-700"
                          type="button"
                          onClick={() => chatFileInputRef.current?.click()}
                          title="Chọn tệp đính kèm"
                        >
                          <Paperclip size={14} />
                        </button>
                        {chatFile && <span className="truncate text-xs text-slate-600">{chatFile.name}</span>}
                      </div>

                      <div className="flex gap-2">
                        <input
                          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                          placeholder={messageType === "text" ? "Nhập tin nhắn..." : "Nhập ghi chú (tùy chọn)..."}
                          value={messageInput}
                          onChange={(event) => onMessageInputChange(event.target.value)}
                        />
                        <input
                          ref={chatFileInputRef}
                          className="hidden"
                          type="file"
                          aria-label="Đính kèm file chat"
                          title="Đính kèm file chat"
                          onChange={(event) => setChatFile(event.target.files?.[0] || null)}
                        />
                        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={onSendMessage} disabled={isLoading} title="Gửi tin nhắn">
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-[420px] flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm text-slate-500">Chọn hội thoại để bắt đầu nhắn tin.</p>
                    <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs" type="button" onClick={() => setIsQuickCreateOpen(true)}>
                      Tạo hội thoại mới
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {dashboardTab === "friends" && (
            <div>
              <div className="mb-3 flex gap-2">
                <input className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Tìm user theo tên/email/sđt (ví dụ: 0912...)" value={userSearchKeyword} onChange={(event) => setUserSearchKeyword(event.target.value)} />
                <button className="rounded-xl border border-brand-300 px-3 py-2 text-sm" type="button" onClick={onSearchUsers}>Tìm</button>
              </div>

              <div className="mb-4 rounded-xl bg-slate-50 p-3">
                <h3 className="mb-2 text-sm font-semibold">Kết quả tìm user</h3>
                {userSearchResults.map((user) => (
                  <div key={user.id} className="mb-2 flex items-center justify-between rounded-lg bg-white p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                        ) : (
                          (user.full_name || "U").charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                      <div className="font-semibold">{user.full_name}</div>
                      <div className="text-xs text-slate-500">ID: {user.id} • {user.email || user.phone || "N/A"}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-lg border border-brand-300 px-2 py-1 text-xs" type="button" onClick={() => onRequestFriend(user.id)}>Kết bạn</button>
                      <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" type="button" onClick={() => onStartChatWithUser(user.id)}>Nhắn tin</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <h3 className="mb-2 text-sm font-semibold">Danh sách bạn bè</h3>
                {friends.map((friend) => (
                  <div key={friend.id} className="mb-2 flex items-center justify-between rounded-lg bg-white p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                          {friend.avatarUrl ? (
                            <img src={friend.avatarUrl} alt={friend.fullName} className="h-full w-full object-cover" />
                          ) : (
                            (friend.fullName || "U").charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-white ${onlineUsers[friend.id] ? "bg-emerald-500" : "bg-slate-300"}`} />
                      </div>
                      <div>
                      <div className="font-semibold">{friend.fullName}</div>
                      <div className="text-xs text-slate-500">{onlineUsers[friend.id] ? "Online" : "Offline"} • {friend.status}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" type="button" onClick={() => onStartChatWithUser(friend.id)}>Nhắn tin</button>
                      {friend.status === "pending" && !friend.requestedByMe && (
                        <button className="rounded-lg border border-brand-300 px-2 py-1 text-xs" type="button" onClick={() => onAcceptFriend(friend.id)}>Chấp nhận</button>
                      )}
                      <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" type="button" onClick={() => onRemoveFriend(friend.id)}>Xóa</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboardTab === "notifications" && (
            <div>
              <button className="mb-3 rounded-xl border border-brand-300 px-3 py-2 text-sm" type="button" onClick={onReadAllNotifications}>Đánh dấu đã đọc tất cả</button>
              <div className="space-y-2">
                {notifications.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="font-semibold text-slate-800">{item.title}</div>
                    <div className="text-slate-600">{item.body || "(không có nội dung)"}</div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</div>
                    {!item.is_read && (
                      <button className="mt-2 rounded-lg border border-brand-300 px-2 py-1 text-xs" type="button" onClick={() => onReadNotification(item.id)}>Đánh dấu đã đọc</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboardTab === "settings" && settings && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                { key: "privacyLastSeen", label: "Hiển thị trạng thái online" },
                { key: "privacyProfilePhoto", label: "Hiển thị ảnh đại diện" },
                { key: "allowFriendRequests", label: "Cho phép gửi lời mời kết bạn" },
                { key: "notificationMessages", label: "Nhận thông báo tin nhắn" },
                { key: "notificationCalls", label: "Nhận thông báo cuộc gọi" }
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings[item.key as keyof UserSettings])}
                    onChange={(event) =>
                      onUpdateSettings({ [item.key]: event.target.checked } as Partial<UserSettings>)
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </section>

        {isProfilePanelOpen && profile && (
          <aside className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl ring-1 ring-brand-100">
            <h2 className="mb-4 text-xl font-semibold text-brand-900">Hồ sơ cá nhân</h2>
            <div className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
              <div>Email/Số điện thoại: {profile.email || profile.phone || "N/A"}</div>
              <div>Xác thực: {profile.isVerified ? "Đã xác thực" : "Chưa xác thực"}</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Họ tên</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
                  aria-label="Họ tên hồ sơ"
                  title="Họ tên hồ sơ"
                  placeholder="Nhập họ tên"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Ngày sinh</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
                  type="date"
                  aria-label="Ngày sinh hồ sơ"
                  title="Ngày sinh hồ sơ"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Giới tính</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
                  aria-label="Giới tính hồ sơ"
                  title="Giới tính hồ sơ"
                  value={gender}
                  onChange={(event) => setGender(event.target.value as Gender | "")}
                >
                  <option value="">Chưa chọn</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Ảnh đại diện</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
                  type="file"
                  accept="image/*"
                  aria-label="Ảnh đại diện trong hồ sơ"
                  title="Chọn ảnh đại diện mới"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                />
                {profile.avatarUrl && <p className="mt-1 text-xs text-slate-500">Ảnh hiện tại đã có trên S3.</p>}
              </div>
            </div>

            <button
              className="mt-4 w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
              type="button"
              onClick={onUpdateProfile}
              disabled={isLoading || isUploadingAvatar}
            >
              {isUploadingAvatar ? "Đang tải ảnh lên S3..." : "Cập nhật hồ sơ"}
            </button>

            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <h3 className="mb-2 text-base font-semibold text-brand-900">Đổi mật khẩu</h3>
              <input
                className="mb-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
                type="password"
                placeholder="Mật khẩu hiện tại"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-brand-500"
                type="password"
                placeholder="Mật khẩu mới"
                value={newAuthPassword}
                onChange={(event) => setNewAuthPassword(event.target.value)}
              />
              <button
                className="mt-3 w-full rounded-xl border border-brand-700 px-4 py-2.5 font-semibold text-brand-700"
                type="button"
                onClick={onChangePassword}
                disabled={isLoading}
              >
                Đổi mật khẩu
              </button>
            </div>
          </aside>
        )}
      </div>

      {isQuickCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Tạo hội thoại nhanh</h3>
              <button
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                type="button"
                onClick={() => setIsQuickCreateOpen(false)}
              >
                Đóng
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="User ID chat 1-1"
                value={directUserIdInput}
                onChange={(event) => setDirectUserIdInput(event.target.value)}
              />
              <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm" type="button" onClick={onCreateDirectConversation}>
                Tạo chat 1-1
              </button>

              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Tên nhóm"
                value={groupNameInput}
                onChange={(event) => setGroupNameInput(event.target.value)}
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Member IDs: 2,3,4"
                value={groupMemberIdsInput}
                onChange={(event) => setGroupMemberIdsInput(event.target.value)}
              />
            </div>

            <button className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="button" onClick={onCreateGroupConversation}>
              Tạo nhóm
            </button>
          </div>
        </div>
      )}

      {message && <p className="mx-auto mt-4 w-full max-w-5xl rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
    </div>
  );

  if (profile) {
    return renderHome();
  }

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

        <form className="space-y-4" onSubmit={onSubmit}>
          <h2 className="text-2xl font-semibold text-brand-900">{title}</h2>
          {renderAuthFields()}

          <button
            className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Đang xử lý..." : title}
          </button>

          {mode === "login" && (
            <button
              className="w-full text-sm font-medium text-brand-700 underline"
              type="button"
              onClick={() => setMode("forgot")}
            >
              Quên mật khẩu?
            </button>
          )}

          {mode === "verify" && (
            <button
              className="w-full rounded-xl border border-brand-700 px-4 py-3 font-semibold text-brand-700"
              type="button"
              onClick={onResendVerification}
              disabled={isLoading}
            >
              Gửi lại mã OTP
            </button>
          )}

          {mode === "forgot" && (
            <button
              className="w-full rounded-xl border border-brand-700 px-4 py-3 font-semibold text-brand-700"
              type="button"
              onClick={() => setMode("reset")}
            >
              Tôi đã có mã đặt lại
            </button>
          )}

          {(mode === "forgot" || mode === "reset" || mode === "verify") && (
            <button
              className="w-full text-sm font-medium text-slate-600 underline"
              type="button"
              onClick={() => setMode("login")}
            >
              Quay về đăng nhập
            </button>
          )}
        </form>

        {message && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
      </div>
    </main>
  );
}

export default App;
