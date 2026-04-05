const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { z } = require("zod");
const env = require("../config/env");
const { s3Client, hasAwsConfig } = require("../config/aws");
const {
  findUserById
} = require("../models/user.model");
const {
  listConversationsByUser,
  isConversationMember,
  getConversationById,
  getConversationMembers,
  createDirectConversation,
  createGroupConversation,
  addMember,
  removeMember,
  updateMemberRole,
  getMemberRole,
  listMessages,
  createMessage,
  markConversationSeen,
  setNotificationsEnabled,
  searchMessagesByKeyword
} = require("../models/chat.model");
const { createNotification } = require("../models/social.model");
const { getIo } = require("../socket/realtime");

const directConversationSchema = z.object({
  userId: z.number().int().positive()
});

const groupConversationSchema = z.object({
  name: z.string().min(2).max(255),
  avatarUrl: z.string().url().max(1024).optional(),
  memberIds: z.array(z.number().int().positive()).min(1)
});

const messageSchema = z.object({
  type: z.enum(["text", "image", "video", "audio", "file", "sticker"]).default("text"),
  text: z.string().max(5000).optional(),
  mediaUrl: z.string().url().max(1024).optional(),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(255).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  sticker: z.string().max(255).optional()
});

const addMemberSchema = z.object({
  userId: z.number().int().positive()
});

const updateAdminSchema = z.object({
  userId: z.number().int().positive(),
  isAdmin: z.boolean()
});

const updateNotificationSchema = z.object({
  enabled: z.boolean()
});

const toConversationPayload = (conversation, members = []) => ({
  id: conversation.id,
  type: conversation.type,
  name: conversation.name,
  avatarUrl: conversation.avatar_url,
  createdBy: conversation.created_by,
  createdAt: conversation.created_at,
  updatedAt: conversation.updated_at,
  role: conversation.role,
  unreadCount: Number(conversation.unread_count || 0),
  notificationsEnabled: Boolean(conversation.notifications_enabled),
  lastReadAt: conversation.last_read_at,
  lastMessage: conversation.last_message_id
    ? {
        id: conversation.last_message_id,
        senderId: conversation.last_message_sender_id,
        type: conversation.last_message_type,
        text: conversation.last_message_text,
        mediaUrl: conversation.last_message_media_url,
        createdAt: conversation.last_message_created_at
      }
    : null,
  members: members.map((item) => ({
    userId: item.user_id,
    fullName: item.full_name,
    avatarUrl: item.avatar_url,
    email: item.email,
    phone: item.phone,
    role: item.role,
    notificationsEnabled: Boolean(item.notifications_enabled),
    joinedAt: item.joined_at,
    lastReadAt: item.last_read_at
  }))
});

const toMessagePayload = (row) => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  senderName: row.sender_name,
  senderAvatar: row.sender_avatar,
  type: row.type,
  text: row.text_content,
  mediaUrl: row.media_url,
  fileName: row.file_name,
  mimeType: row.mime_type,
  fileSize: row.file_size,
  meta: row.meta_json ? JSON.parse(row.meta_json) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const ensureMembership = async (conversationId, userId) => {
  const joined = await isConversationMember(conversationId, userId);
  if (!joined) {
    const error = new Error("Bạn không thuộc cuộc trò chuyện này");
    error.statusCode = 403;
    throw error;
  }
};

const listConversations = async (req, res) => {
  try {
    const rows = await listConversationsByUser(req.user.id);
    const payload = [];

    for (const row of rows) {
      const members = await getConversationMembers(row.id);
      payload.push(toConversationPayload(row, members));
    }

    return res.json({ conversations: payload });
  } catch (error) {
    return res.status(500).json({ message: "Không thể lấy danh sách hội thoại", error: error.message });
  }
};

const createDirect = async (req, res) => {
  try {
    const input = directConversationSchema.parse(req.body);

    if (input.userId === req.user.id) {
      return res.status(400).json({ message: "Không thể tạo hội thoại với chính mình" });
    }

    const target = await findUserById(input.userId);
    if (!target) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const conversationId = await createDirectConversation(req.user.id, input.userId);
    const conversation = await getConversationById(conversationId);
    const members = await getConversationMembers(conversationId);
    return res.status(201).json({ conversation: toConversationPayload(conversation, members) });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", issues: error.issues });
    }
    return res.status(500).json({ message: "Không thể tạo hội thoại 1-1", error: error.message });
  }
};

const createGroup = async (req, res) => {
  try {
    const input = groupConversationSchema.parse(req.body);
    const memberIds = [...new Set(input.memberIds.filter((id) => id !== req.user.id))];

    for (const userId of memberIds) {
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({ message: `Không tìm thấy user ${userId}` });
      }
    }

    const conversationId = await createGroupConversation({
      creatorId: req.user.id,
      name: input.name,
      avatarUrl: input.avatarUrl,
      memberIds
    });

    const conversation = await getConversationById(conversationId);
    const members = await getConversationMembers(conversationId);
    return res.status(201).json({ conversation: toConversationPayload(conversation, members) });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", issues: error.issues });
    }
    return res.status(500).json({ message: "Không thể tạo nhóm", error: error.message });
  }
};

const getConversationDetail = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    await ensureMembership(conversationId, req.user.id);

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Không tìm thấy hội thoại" });
    }

    const members = await getConversationMembers(conversationId);
    return res.json({ conversation: toConversationPayload(conversation, members) });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: "Không thể lấy thông tin hội thoại", error: error.message });
  }
};

const getConversationMessages = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    await ensureMembership(conversationId, req.user.id);

    const rows = await listMessages({
      conversationId,
      limit: Number(req.query.limit || 30),
      beforeId: req.query.beforeId ? Number(req.query.beforeId) : undefined
    });

    return res.json({ messages: rows.map(toMessagePayload) });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: "Không thể lấy tin nhắn", error: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    await ensureMembership(conversationId, req.user.id);
    const input = messageSchema.parse(req.body);

    if (input.type === "text" && !input.text?.trim()) {
      return res.status(400).json({ message: "Tin nhắn văn bản không được để trống" });
    }

    if (["image", "video", "audio", "file"].includes(input.type) && !input.mediaUrl) {
      return res.status(400).json({ message: "Tin nhắn media cần mediaUrl" });
    }

    const meta = input.sticker ? { sticker: input.sticker } : null;
    const saved = await createMessage({
      conversationId,
      senderId: req.user.id,
      type: input.type,
      textContent: input.text?.trim(),
      mediaUrl: input.mediaUrl,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      metaJson: meta ? JSON.stringify(meta) : null
    });

    const payload = toMessagePayload(saved);
    const members = await getConversationMembers(conversationId);
    const io = getIo();

    if (io) {
      io.to(`conversation:${conversationId}`).emit("message:new", payload);

      for (const member of members) {
        if (member.user_id === req.user.id) continue;

        io.to(`user:${member.user_id}`).emit("notification:new", {
          type: "message",
          conversationId,
          message: payload
        });
      }
    }

    for (const member of members) {
      if (member.user_id === req.user.id) continue;

      await createNotification({
        userId: member.user_id,
        type: "message",
        title: "Tin nhắn mới",
        body: payload.text || "Bạn nhận được một tin nhắn đa phương tiện",
        metaJson: JSON.stringify({ conversationId, messageId: payload.id })
      });
    }

    return res.status(201).json({ message: payload });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", issues: error.issues });
    }

    return res.status(500).json({ message: "Không thể gửi tin nhắn", error: error.message });
  }
};

const seenConversation = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    await ensureMembership(conversationId, req.user.id);
    await markConversationSeen(conversationId, req.user.id);

    const io = getIo();
    if (io) {
      io.to(`conversation:${conversationId}`).emit("conversation:seen", {
        conversationId,
        userId: req.user.id,
        seenAt: new Date().toISOString()
      });
    }

    return res.json({ message: "Đã cập nhật trạng thái đã xem" });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: "Không thể cập nhật trạng thái xem", error: error.message });
  }
};

const searchMessages = async (req, res) => {
  try {
    const keyword = String(req.query.q || "").trim();
    if (!keyword) {
      return res.status(400).json({ message: "Thiếu từ khóa tìm kiếm" });
    }

    const rows = await searchMessagesByKeyword(req.user.id, keyword);
    return res.json({ messages: rows.map(toMessagePayload) });
  } catch (error) {
    return res.status(500).json({ message: "Không thể tìm kiếm tin nhắn", error: error.message });
  }
};

const addConversationMember = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    await ensureMembership(conversationId, req.user.id);
    const role = await getMemberRole(conversationId, req.user.id);

    if (role !== "admin") {
      return res.status(403).json({ message: "Chỉ admin mới có quyền thêm thành viên" });
    }

    const input = addMemberSchema.parse(req.body);
    const user = await findUserById(input.userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    await addMember(conversationId, input.userId, "member");

    const io = getIo();
    if (io) {
      io.to(`conversation:${conversationId}`).emit("conversation:member-added", {
        conversationId,
        userId: input.userId
      });
    }

    return res.json({ message: "Đã thêm thành viên" });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", issues: error.issues });
    }

    return res.status(500).json({ message: "Không thể thêm thành viên", error: error.message });
  }
};

const removeConversationMember = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    await ensureMembership(conversationId, req.user.id);
    const role = await getMemberRole(conversationId, req.user.id);

    if (role !== "admin") {
      return res.status(403).json({ message: "Chỉ admin mới có quyền xóa thành viên" });
    }

    const targetUserId = Number(req.params.userId);
    await removeMember(conversationId, targetUserId);

    const io = getIo();
    if (io) {
      io.to(`conversation:${conversationId}`).emit("conversation:member-removed", {
        conversationId,
        userId: targetUserId
      });
    }

    return res.json({ message: "Đã xóa thành viên" });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: "Không thể xóa thành viên", error: error.message });
  }
};

const updateConversationAdmin = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    await ensureMembership(conversationId, req.user.id);
    const role = await getMemberRole(conversationId, req.user.id);

    if (role !== "admin") {
      return res.status(403).json({ message: "Chỉ admin mới có quyền phân quyền" });
    }

    const input = updateAdminSchema.parse(req.body);
    await updateMemberRole(conversationId, input.userId, input.isAdmin ? "admin" : "member");

    return res.json({ message: "Cập nhật phân quyền thành công" });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", issues: error.issues });
    }

    return res.status(500).json({ message: "Không thể cập nhật phân quyền", error: error.message });
  }
};

const toggleConversationNotifications = async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    await ensureMembership(conversationId, req.user.id);
    const input = updateNotificationSchema.parse(req.body);

    await setNotificationsEnabled(conversationId, req.user.id, input.enabled);
    return res.json({ message: "Đã cập nhật cài đặt thông báo" });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", issues: error.issues });
    }

    return res.status(500).json({ message: "Không thể cập nhật thông báo", error: error.message });
  }
};

const getMessageUploadUrl = async (req, res) => {
  try {
    if (!hasAwsConfig || !s3Client) {
      return res.status(400).json({ message: "AWS S3 chưa cấu hình" });
    }

    const conversationId = Number(req.params.id);
    await ensureMembership(conversationId, req.user.id);

    const fileName = String(req.body.fileName || "").trim();
    const contentType = String(req.body.contentType || "").trim();

    if (!fileName || !contentType) {
      return res.status(400).json({ message: "fileName và contentType là bắt buộc" });
    }

    const objectKey = `messages/${conversationId}/${req.user.id}/${Date.now()}-${fileName}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: env.aws.bucket,
      Key: objectKey,
      ContentType: contentType
    });

    const signedUploadUrl = await getSignedUrl(s3Client, uploadCommand, { expiresIn: 300 });
    const mediaUrl = `https://${env.aws.bucket}.s3.${env.aws.region}.amazonaws.com/${objectKey}`;

    return res.json({ signedUploadUrl, mediaUrl, key: objectKey });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({ message: "Không thể tạo link upload", error: error.message });
  }
};

module.exports = {
  listConversations,
  createDirect,
  createGroup,
  getConversationDetail,
  getConversationMessages,
  sendMessage,
  seenConversation,
  searchMessages,
  addConversationMember,
  removeConversationMember,
  updateConversationAdmin,
  toggleConversationNotifications,
  getMessageUploadUrl
};
