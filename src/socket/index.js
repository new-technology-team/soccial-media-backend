const { Server } = require("socket.io");
const { verifyAccessToken } = require("../config/jwt");
const { setIo } = require("./realtime");

const onlineCounters = new Map();

const increaseOnline = (userId) => {
  const current = onlineCounters.get(userId) || 0;
  onlineCounters.set(userId, current + 1);
};

const decreaseOnline = (userId) => {
  const current = onlineCounters.get(userId) || 0;
  if (current <= 1) {
    onlineCounters.delete(userId);
    return false;
  }
  onlineCounters.set(userId, current - 1);
  return true;
};

const initializeSocket = (httpServer, corsOrigins) => {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  });

  setIo(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Unauthorized: missing token"));
    }

    try {
      const user = verifyAccessToken(token);
      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized: invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = Number(socket.user.id);
    const roomName = `user:${userId}`;
    socket.join(roomName);
    increaseOnline(userId);

    socket.emit("connected", {
      message: "Socket connected",
      user: socket.user
    });

    socket.broadcast.emit("presence:online", {
      userId,
      isOnline: true
    });

    socket.on("join-conversation", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("leave-conversation", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("typing", (payload = {}) => {
      const conversationId = Number(payload.conversationId);
      if (!conversationId) return;

      socket.to(`conversation:${conversationId}`).emit("conversation:typing", {
        conversationId,
        userId,
        isTyping: Boolean(payload.isTyping)
      });
    });

    socket.on("call:offer", (payload = {}) => {
      const targetUserId = Number(payload.targetUserId);
      if (!targetUserId || !payload.offer) return;

      io.to(`user:${targetUserId}`).emit("call:offer", {
        fromUserId: userId,
        conversationId: Number(payload.conversationId) || null,
        callType: payload.callType || "voice",
        offer: payload.offer
      });
    });

    socket.on("call:answer", (payload = {}) => {
      const targetUserId = Number(payload.targetUserId);
      if (!targetUserId || !payload.answer) return;

      io.to(`user:${targetUserId}`).emit("call:answer", {
        fromUserId: userId,
        conversationId: Number(payload.conversationId) || null,
        answer: payload.answer
      });
    });

    socket.on("call:ice-candidate", (payload = {}) => {
      const targetUserId = Number(payload.targetUserId);
      if (!targetUserId || !payload.candidate) return;

      io.to(`user:${targetUserId}`).emit("call:ice-candidate", {
        fromUserId: userId,
        conversationId: Number(payload.conversationId) || null,
        candidate: payload.candidate
      });
    });

    socket.on("call:end", (payload = {}) => {
      const targetUserId = Number(payload.targetUserId);
      if (!targetUserId) return;

      io.to(`user:${targetUserId}`).emit("call:end", {
        fromUserId: userId,
        conversationId: Number(payload.conversationId) || null
      });
    });

    socket.on("disconnect", () => {
      const stillOnline = decreaseOnline(userId);

      if (!stillOnline) {
        socket.broadcast.emit("presence:online", {
          userId,
          isOnline: false
        });
      }
    });
  });

  return io;
};

module.exports = initializeSocket;
