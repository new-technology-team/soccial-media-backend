const pool = require("../config/db");

const ensureChatSchema = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        name VARCHAR(255) DEFAULT NULL,
        avatar_url VARCHAR(1024) DEFAULT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_conversations_type (type),
        CONSTRAINT fk_conversations_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS conversation_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        user_id INT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_read_at DATETIME DEFAULT NULL,
        UNIQUE KEY uniq_conversation_member (conversation_id, user_id),
        INDEX idx_member_user (user_id),
        CONSTRAINT fk_member_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'text',
        text_content TEXT DEFAULT NULL,
        media_url VARCHAR(1024) DEFAULT NULL,
        file_name VARCHAR(255) DEFAULT NULL,
        mime_type VARCHAR(255) DEFAULT NULL,
        file_size BIGINT DEFAULT NULL,
        meta_json TEXT DEFAULT NULL,
        is_deleted TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_messages_conversation (conversation_id, id),
        CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS message_reads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_message_read (message_id, user_id),
        INDEX idx_message_reads_user (user_id),
        CONSTRAINT fk_message_reads_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        CONSTRAINT fk_message_reads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS call_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NULL,
        initiator_id INT NOT NULL,
        call_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'started',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME NULL,
        meta_json TEXT NULL,
        INDEX idx_call_sessions_conversation (conversation_id),
        INDEX idx_call_sessions_initiator (initiator_id),
        CONSTRAINT fk_call_sessions_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
        CONSTRAINT fk_call_sessions_initiator FOREIGN KEY (initiator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } finally {
    conn.release();
  }
};

const listConversationsByUser = async (userId) => {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `SELECT
         c.id,
         c.type,
         c.name,
         c.avatar_url,
         c.created_by,
         c.created_at,
         c.updated_at,
         cm.role,
         cm.notifications_enabled,
         cm.last_read_at,
         (
           SELECT COUNT(*)
           FROM messages m
           WHERE m.conversation_id = c.id
             AND m.is_deleted = 0
             AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
             AND m.sender_id <> ?
         ) AS unread_count,
         lm.id AS last_message_id,
         lm.sender_id AS last_message_sender_id,
         lm.type AS last_message_type,
         lm.text_content AS last_message_text,
         lm.media_url AS last_message_media_url,
         lm.created_at AS last_message_created_at
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       LEFT JOIN messages lm ON lm.id = (
         SELECT m2.id
         FROM messages m2
         WHERE m2.conversation_id = c.id AND m2.is_deleted = 0
         ORDER BY m2.id DESC
         LIMIT 1
       )
       WHERE cm.user_id = ?
       ORDER BY COALESCE(lm.created_at, c.updated_at) DESC, c.updated_at DESC`,
      [userId, userId]
    );
  } finally {
    conn.release();
  }
};

const isConversationMember = async (conversationId, userId) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      "SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1",
      [conversationId, userId]
    );
    return Boolean(rows[0]);
  } finally {
    conn.release();
  }
};

const getConversationById = async (conversationId) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query("SELECT * FROM conversations WHERE id = ? LIMIT 1", [conversationId]);
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

const getConversationMembers = async (conversationId) => {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `SELECT
         cm.user_id,
         cm.role,
         cm.notifications_enabled,
         cm.joined_at,
         cm.last_read_at,
         u.full_name,
         u.avatar_url,
         u.email,
         u.phone
       FROM conversation_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = ?
       ORDER BY cm.joined_at ASC`,
      [conversationId]
    );
  } finally {
    conn.release();
  }
};

const createDirectConversation = async (userAId, userBId) => {
  const conn = await pool.getConnection();
  try {
    const existing = await conn.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = ?
       JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = ?
       WHERE c.type = 'direct'
       LIMIT 1`,
      [userAId, userBId]
    );

    if (existing[0]) {
      return existing[0].id;
    }

    const created = await conn.query(
      "INSERT INTO conversations (type, name, created_by) VALUES ('direct', NULL, ?)",
      [userAId]
    );
    const conversationId = Number(created.insertId);

    await conn.query(
      "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, 'admin'), (?, ?, 'admin')",
      [conversationId, userAId, conversationId, userBId]
    );

    return conversationId;
  } finally {
    conn.release();
  }
};

const createGroupConversation = async ({ creatorId, name, memberIds, avatarUrl }) => {
  const conn = await pool.getConnection();
  try {
    const created = await conn.query(
      "INSERT INTO conversations (type, name, avatar_url, created_by) VALUES ('group', ?, ?, ?)",
      [name, avatarUrl || null, creatorId]
    );

    const conversationId = Number(created.insertId);
    const uniqueMembers = [...new Set([creatorId, ...memberIds])];

    for (const memberId of uniqueMembers) {
      const role = memberId === creatorId ? "admin" : "member";
      await conn.query(
        "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, ?)",
        [conversationId, memberId, role]
      );
    }

    return conversationId;
  } finally {
    conn.release();
  }
};

const addMember = async (conversationId, userId, role = "member") => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)",
      [conversationId, userId, role]
    );
  } finally {
    conn.release();
  }
};

const removeMember = async (conversationId, userId) => {
  const conn = await pool.getConnection();
  try {
    await conn.query("DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?", [conversationId, userId]);
  } finally {
    conn.release();
  }
};

const updateMemberRole = async (conversationId, userId, role) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "UPDATE conversation_members SET role = ? WHERE conversation_id = ? AND user_id = ?",
      [role, conversationId, userId]
    );
  } finally {
    conn.release();
  }
};

const getMemberRole = async (conversationId, userId) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      "SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1",
      [conversationId, userId]
    );
    return rows[0]?.role || null;
  } finally {
    conn.release();
  }
};

const listMessages = async ({ conversationId, limit = 30, beforeId }) => {
  const conn = await pool.getConnection();
  try {
    const params = [conversationId];
    let query = `
      SELECT
        m.*,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ?
        AND m.is_deleted = 0
    `;

    if (beforeId) {
      query += " AND m.id < ?";
      params.push(beforeId);
    }

    query += " ORDER BY m.id DESC LIMIT ?";
    params.push(Math.max(1, Math.min(100, Number(limit) || 30)));

    const rows = await conn.query(query, params);
    return rows.reverse();
  } finally {
    conn.release();
  }
};

const createMessage = async ({ conversationId, senderId, type, textContent, mediaUrl, fileName, mimeType, fileSize, metaJson }) => {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO messages (
        conversation_id,
        sender_id,
        type,
        text_content,
        media_url,
        file_name,
        mime_type,
        file_size,
        meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversationId,
        senderId,
        type || "text",
        textContent || null,
        mediaUrl || null,
        fileName || null,
        mimeType || null,
        fileSize || null,
        metaJson || null
      ]
    );

    const rows = await conn.query(
      `SELECT m.*, u.full_name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.id = ? LIMIT 1`,
      [Number(result.insertId)]
    );

    return rows[0] || null;
  } finally {
    conn.release();
  }
};

const markConversationSeen = async (conversationId, userId) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = ? AND user_id = ?",
      [conversationId, userId]
    );
  } finally {
    conn.release();
  }
};

const setNotificationsEnabled = async (conversationId, userId, enabled) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "UPDATE conversation_members SET notifications_enabled = ? WHERE conversation_id = ? AND user_id = ?",
      [enabled ? 1 : 0, conversationId, userId]
    );
  } finally {
    conn.release();
  }
};

const searchMessagesByKeyword = async (userId, keyword) => {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `SELECT
         m.id,
         m.conversation_id,
         m.sender_id,
         m.type,
         m.text_content,
         m.media_url,
         m.created_at,
         u.full_name AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
       WHERE cm.user_id = ?
         AND m.is_deleted = 0
         AND m.text_content IS NOT NULL
         AND m.text_content LIKE ?
       ORDER BY m.created_at DESC
       LIMIT 100`,
      [userId, `%${keyword}%`]
    );
  } finally {
    conn.release();
  }
};

module.exports = {
  ensureChatSchema,
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
};
