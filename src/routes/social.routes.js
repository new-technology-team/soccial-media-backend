const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const {
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
} = require("../controllers/social.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/friends", listFriends);
router.get("/users/search", findUsers);
router.post("/friends/request", requestFriend);
router.post("/friends/:userId/accept", acceptFriend);
router.delete("/friends/:userId", deleteFriend);

router.get("/settings", getSettings);
router.put("/settings", saveSettings);

router.get("/notifications", getNotifications);
router.patch("/notifications/:id/read", readNotification);
router.patch("/notifications/read-all", readAllNotifications);

module.exports = router;
