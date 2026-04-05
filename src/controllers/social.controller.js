const { z } = require("zod");
const { findUserById } = require("../models/user.model");
const {
  listFriendships,
  searchUsers,
  upsertFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  getUserSettings,
  updateUserSettings,
  createNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require("../models/social.model");
const { getIo } = require("../socket/realtime");

const friendRequestSchema = z.object({
  userId: z.number().int().positive()
});

const settingsSchema = z.object({
  privacyLastSeen: z.boolean().optional(),
  privacyProfilePhoto: z.boolean().optional(),
  allowFriendRequests: z.boolean().optional(),
  notificationMessages: z.boolean().optional(),
  notificationCalls: z.boolean().optional()
});

const toFriendPayload = (row, currentUserId) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone,
  avatarUrl: row.avatar_url,
  isVerified: Boolean(row.is_verified),
  status: row.status,
  requestedByMe: Number(row.requested_by) === Number(currentUserId),
  createdAt: row.created_at
});

const toSettingsPayload = (row) => ({
  privacyLastSeen: Boolean(row.privacy_last_seen),
  privacyProfilePhoto: Boolean(row.privacy_profile_photo),
  allowFriendRequests: Boolean(row.allow_friend_requests),
  notificationMessages: Boolean(row.notification_messages),
  notificationCalls: Boolean(row.notification_calls),
  updatedAt: row.updated_at
});

const listFriends = async (req, res) => {
  try {
    const rows = await listFriendships(req.user.id);
    return res.json({ friends: rows.map((item) => toFriendPayload(item, req.user.id)) });
  } catch (error) {
    return res.status(500).json({ message: "Không thể lấy danh sách bạn bè", error: error.message });
  }
};

const findUsers = async (req, res) => {
  try {
    const keyword = String(req.query.q || "").trim();
    if (!keyword) {
      return res.status(400).json({ message: "Thiếu từ khóa tìm kiếm" });
    }

    const rows = await searchUsers(keyword, req.user.id);
    return res.json({ users: rows });
  } catch (error) {
    return res.status(500).json({ message: "Không thể tìm kiếm người dùng", error: error.message });
  }
};

const requestFriend = async (req, res) => {
  try {
    const input = friendRequestSchema.parse(req.body);

    if (input.userId === req.user.id) {
      return res.status(400).json({ message: "Không thể kết bạn với chính mình" });
    }

    const user = await findUserById(input.userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    await upsertFriendRequest(req.user.id, input.userId);

    await createNotification({
      userId: input.userId,
      type: "friend-request",
      title: "Yêu cầu kết bạn mới",
      body: `${req.user.fullName || "Có người"} đã gửi lời mời kết bạn`,
      metaJson: JSON.stringify({ requesterId: req.user.id })
    });

    const io = getIo();
    if (io) {
      io.to(`user:${input.userId}`).emit("friend:request", {
        fromUserId: req.user.id,
        fromName: req.user.fullName
      });
    }

    return res.json({ message: "Đã gửi yêu cầu kết bạn" });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", issues: error.issues });
    }
    return res.status(500).json({ message: "Không thể gửi yêu cầu kết bạn", error: error.message });
  }
};

const acceptFriend = async (req, res) => {
  try {
    const requesterId = Number(req.params.userId);
    const accepted = await acceptFriendRequest(req.user.id, requesterId);

    if (!accepted) {
      return res.status(400).json({ message: "Không tìm thấy yêu cầu kết bạn chờ xử lý" });
    }

    const io = getIo();
    if (io) {
      io.to(`user:${requesterId}`).emit("friend:accepted", {
        userId: req.user.id,
        fullName: req.user.fullName
      });
    }

    await createNotification({
      userId: requesterId,
      type: "friend-accepted",
      title: "Lời mời kết bạn đã được chấp nhận",
      body: `${req.user.fullName || "Một người dùng"} đã chấp nhận lời mời của bạn`,
      metaJson: JSON.stringify({ accepterId: req.user.id })
    });

    return res.json({ message: "Đã chấp nhận lời mời kết bạn" });
  } catch (error) {
    return res.status(500).json({ message: "Không thể chấp nhận lời mời", error: error.message });
  }
};

const deleteFriend = async (req, res) => {
  try {
    const friendUserId = Number(req.params.userId);
    await removeFriendship(req.user.id, friendUserId);
    return res.json({ message: "Đã xóa bạn" });
  } catch (error) {
    return res.status(500).json({ message: "Không thể xóa bạn", error: error.message });
  }
};

const getSettings = async (req, res) => {
  try {
    const settings = await getUserSettings(req.user.id);
    return res.json({ settings: toSettingsPayload(settings) });
  } catch (error) {
    return res.status(500).json({ message: "Không thể lấy cài đặt", error: error.message });
  }
};

const saveSettings = async (req, res) => {
  try {
    const input = settingsSchema.parse(req.body);
    const settings = await updateUserSettings(req.user.id, input);
    return res.json({ message: "Cập nhật cài đặt thành công", settings: toSettingsPayload(settings) });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", issues: error.issues });
    }

    return res.status(500).json({ message: "Không thể cập nhật cài đặt", error: error.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const rows = await listNotifications(req.user.id, Number(req.query.limit || 50));
    return res.json({ notifications: rows });
  } catch (error) {
    return res.status(500).json({ message: "Không thể lấy thông báo", error: error.message });
  }
};

const readNotification = async (req, res) => {
  try {
    const notificationId = Number(req.params.id);
    await markNotificationRead(notificationId, req.user.id);
    return res.json({ message: "Đã đánh dấu đã đọc" });
  } catch (error) {
    return res.status(500).json({ message: "Không thể cập nhật thông báo", error: error.message });
  }
};

const readAllNotifications = async (req, res) => {
  try {
    await markAllNotificationsRead(req.user.id);
    return res.json({ message: "Đã đánh dấu toàn bộ đã đọc" });
  } catch (error) {
    return res.status(500).json({ message: "Không thể cập nhật thông báo", error: error.message });
  }
};

module.exports = {
  listFriends,
  findUsers,
  requestFriend,
  acceptFriend,
  deleteFriend,
  getSettings,
  saveSettings,
  getNotifications,
  readNotification,
  readAllNotifications
};
