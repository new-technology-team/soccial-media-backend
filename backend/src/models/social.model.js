const pool = require("../config/db");

const ensureSocialSchema = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        requested_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_friend_pair (user_id, friend_id),
        INDEX idx_friend_user (user_id),
        INDEX idx_friend_status (status),
        CONSTRAINT fk_friend_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_friend_friend FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INT PRIMARY KEY,
        privacy_last_seen TINYINT(1) NOT NULL DEFAULT 1,
        privacy_profile_photo TINYINT(1) NOT NULL DEFAULT 1,
        allow_friend_requests TINYINT(1) NOT NULL DEFAULT 1,
        notification_messages TINYINT(1) NOT NULL DEFAULT 1,
        notification_calls TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(40) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT DEFAULT NULL,
        meta_json TEXT DEFAULT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notification_user (user_id, created_at),
        CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        contact_name VARCHAR(255) NULL,
        phone VARCHAR(30) NOT NULL,
        normalized_phone VARCHAR(30) NOT NULL,
        matched_user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_contact_phone (user_id, normalized_phone),
        INDEX idx_contact_user (user_id),
        INDEX idx_contact_matched_user (matched_user_id),
        CONSTRAINT fk_contact_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_contact_matched_user FOREIGN KEY (matched_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        platform VARCHAR(20) NOT NULL,
        device_token VARCHAR(512) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_device_token (user_id, device_token),
        INDEX idx_user_devices_user (user_id),
        CONSTRAINT fk_user_device_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        blocked_user_id INT NOT NULL,
        reason VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_block (user_id, blocked_user_id),
        INDEX idx_user_blocks_user (user_id),
        CONSTRAINT fk_user_block_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_block_blocked_user FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } finally {
    conn.release();
  }
};

const normalizePair = (a, b) => (a < b ? [a, b] : [b, a]);

const listFriendships = async (userId) => {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `SELECT
         f.status,
         f.requested_by,
         f.created_at,
         u.id,
         u.full_name,
         u.email,
         u.phone,
         u.avatar_url,
         u.is_verified
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       WHERE f.user_id = ? OR f.friend_id = ?
       ORDER BY f.updated_at DESC`,
      [userId, userId, userId]
    );
  } finally {
    conn.release();
  }
};

const searchUsers = async (query, excludeUserId) => {
  const conn = await pool.getConnection();
  try {
    const normalizedPhoneQuery = String(query || "").replace(/[^0-9]/g, "");

    return await conn.query(
      `SELECT id, full_name, email, phone, avatar_url, is_verified
       FROM users
       WHERE id <> ?
         AND (
           full_name LIKE ?
           OR email LIKE ?
           OR phone LIKE ?
           OR (
             ? <> ''
             AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') LIKE ?
           )
         )
       ORDER BY full_name ASC
       LIMIT 50`,
      [
        excludeUserId,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        normalizedPhoneQuery,
        `%${normalizedPhoneQuery}%`
      ]
    );
  } finally {
    conn.release();
  }
};

const upsertFriendRequest = async (requesterId, targetId) => {
  const conn = await pool.getConnection();
  try {
    const [userId, friendId] = normalizePair(requesterId, targetId);
    await conn.query(
      `INSERT INTO friendships (user_id, friend_id, status, requested_by)
       VALUES (?, ?, 'pending', ?)
       ON DUPLICATE KEY UPDATE status = 'pending', requested_by = VALUES(requested_by)`,
      [userId, friendId, requesterId]
    );
  } finally {
    conn.release();
  }
};

const acceptFriendRequest = async (userId, otherUserId) => {
  const conn = await pool.getConnection();
  try {
    const [a, b] = normalizePair(userId, otherUserId);
    const result = await conn.query(
      `UPDATE friendships
       SET status = 'accepted'
       WHERE user_id = ?
         AND friend_id = ?
         AND status = 'pending'`,
      [a, b]
    );
    return result.affectedRows > 0;
  } finally {
    conn.release();
  }
};

const removeFriendship = async (userId, otherUserId) => {
  const conn = await pool.getConnection();
  try {
    const [a, b] = normalizePair(userId, otherUserId);
    await conn.query("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?", [a, b]);
  } finally {
    conn.release();
  }
};

const getUserSettings = async (userId) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query("SELECT * FROM user_settings WHERE user_id = ? LIMIT 1", [userId]);
    if (rows[0]) {
      return rows[0];
    }

    await conn.query("INSERT INTO user_settings (user_id) VALUES (?)", [userId]);
    const inserted = await conn.query("SELECT * FROM user_settings WHERE user_id = ? LIMIT 1", [userId]);
    return inserted[0] || null;
  } finally {
    conn.release();
  }
};

const updateUserSettings = async (userId, payload) => {
  const conn = await pool.getConnection();
  try {
    const fields = [];
    const values = [];

    const mappings = {
      privacyLastSeen: "privacy_last_seen",
      privacyProfilePhoto: "privacy_profile_photo",
      allowFriendRequests: "allow_friend_requests",
      notificationMessages: "notification_messages",
      notificationCalls: "notification_calls"
    };

    for (const key of Object.keys(mappings)) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        fields.push(`${mappings[key]} = ?`);
        values.push(payload[key] ? 1 : 0);
      }
    }

    if (fields.length) {
      values.push(userId);
      await conn.query(`UPDATE user_settings SET ${fields.join(", ")} WHERE user_id = ?`, values);
    }

    const rows = await conn.query("SELECT * FROM user_settings WHERE user_id = ? LIMIT 1", [userId]);
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

const createNotification = async ({ userId, type, title, body, metaJson }) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "INSERT INTO notifications (user_id, type, title, body, meta_json) VALUES (?, ?, ?, ?, ?)",
      [userId, type, title, body || null, metaJson || null]
    );
  } finally {
    conn.release();
  }
};

const listNotifications = async (userId, limit = 50) => {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, Math.max(1, Math.min(200, Number(limit) || 50))]
    );
  } finally {
    conn.release();
  }
};

const markNotificationRead = async (notificationId, userId) => {
  const conn = await pool.getConnection();
  try {
    await conn.query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [notificationId, userId]);
  } finally {
    conn.release();
  }
};

const markAllNotificationsRead = async (userId) => {
  const conn = await pool.getConnection();
  try {
    await conn.query("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [userId]);
  } finally {
    conn.release();
  }
};

module.exports = {
  ensureSocialSchema,
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
};
