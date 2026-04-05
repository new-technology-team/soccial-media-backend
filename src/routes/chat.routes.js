const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const {
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
  getMessageUploadUrl,
  uploadMessageBase64
} = require("../controllers/chat.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/conversations", listConversations);
router.post("/conversations/direct", createDirect);
router.post("/conversations/group", createGroup);
router.get("/conversations/:id", getConversationDetail);
router.get("/conversations/:id/messages", getConversationMessages);
router.post("/conversations/:id/messages", sendMessage);
router.post("/conversations/:id/messages/upload-url", getMessageUploadUrl);
router.post("/conversations/:id/messages/upload-base64", uploadMessageBase64);
router.patch("/conversations/:id/seen", seenConversation);
router.patch("/conversations/:id/notifications", toggleConversationNotifications);
router.post("/conversations/:id/members", addConversationMember);
router.delete("/conversations/:id/members/:userId", removeConversationMember);
router.patch("/conversations/:id/admins", updateConversationAdmin);
router.get("/search/messages", searchMessages);

module.exports = router;
