const pool = require("../config/db");

const ensureUserSchema = async () => {
  const conn = await pool.getConnection();
  try {
    // Create table if not exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20) UNIQUE,
        full_name VARCHAR(120) NOT NULL,
        date_of_birth DATE DEFAULT NULL,
        gender VARCHAR(20) DEFAULT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(1024) DEFAULT NULL,
        is_verified TINYINT(1) NOT NULL DEFAULT 0,
        verification_code VARCHAR(20) DEFAULT NULL,
        verification_expires_at DATETIME DEFAULT NULL,
        reset_code VARCHAR(20) DEFAULT NULL,
        reset_expires_at DATETIME DEFAULT NULL,
        refresh_token TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT chk_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
      )
    `);

    // Add columns if they don't exist (for existing tables)
    await conn.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE"
    );
    await conn.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL"
    );
    await conn.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NULL"
    );
    // refresh_token can exceed 512 chars when profile payload is large.
    await conn.query("ALTER TABLE users MODIFY COLUMN refresh_token TEXT NULL");
    await conn.query(
      "ALTER TABLE users ADD CONSTRAINT chk_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)"
    ).catch(() => {
      // Constraint may already exist, ignore error
    });
  } finally {
    conn.release();
  }
};

const findUserByEmail = async (email) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

const findUserByPhone = async (phone) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query("SELECT * FROM users WHERE phone = ? LIMIT 1", [phone]);
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

const findUserByEmailOrPhone = async (emailOrPhone) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      "SELECT * FROM users WHERE email = ? OR phone = ? LIMIT 1",
      [emailOrPhone, emailOrPhone]
    );
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

const findUserById = async (id) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

const createUser = async ({ email, phone, fullName, dateOfBirth, gender, avatarUrl, passwordHash }) => {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      "INSERT INTO users (email, phone, full_name, date_of_birth, gender, avatar_url, password_hash, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [email || null, phone || null, fullName, dateOfBirth || null, gender || null, avatarUrl || null, passwordHash, 0]
    );

    return findUserById(Number(result.insertId));
  } finally {
    conn.release();
  }
};

const updateRefreshToken = async (userId, refreshToken) => {
  const conn = await pool.getConnection();
  try {
    await conn.query("UPDATE users SET refresh_token = ? WHERE id = ?", [refreshToken, userId]);
  } finally {
    conn.release();
  }
};

const saveVerificationCode = async (identifier, code, expiresAt) => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE email = ? OR phone = ?",
      [code, expiresAt, identifier, identifier]
    );
  } finally {
    conn.release();
  }
};

const verifyUserByCode = async (identifier, code) => {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `UPDATE users
       SET is_verified = 1,
           verification_code = NULL,
           verification_expires_at = NULL
       WHERE (email = ? OR phone = ?)
         AND verification_code = ?
         AND verification_expires_at IS NOT NULL
         AND verification_expires_at > NOW()`,
      [identifier, identifier, code]
    );

    return result.affectedRows > 0;
  } finally {
    conn.release();
  }
};

const saveResetCode = async (identifier, code, expiresAt) => {
  const conn = await pool.getConnection();
  try {
    await conn.query("UPDATE users SET reset_code = ?, reset_expires_at = ? WHERE email = ? OR phone = ?", [
      code,
      expiresAt,
      identifier,
      identifier
    ]);
  } finally {
    conn.release();
  }
};

const resetPasswordByCode = async (identifier, code, passwordHash) => {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `UPDATE users
       SET password_hash = ?,
           reset_code = NULL,
           reset_expires_at = NULL,
           refresh_token = NULL
       WHERE (email = ? OR phone = ?)
         AND reset_code = ?
         AND reset_expires_at IS NOT NULL
         AND reset_expires_at > NOW()`,
      [passwordHash, identifier, identifier, code]
    );

    return result.affectedRows > 0;
  } finally {
    conn.release();
  }
};

const updatePasswordById = async (userId, passwordHash) => {
  const conn = await pool.getConnection();
  try {
    await conn.query("UPDATE users SET password_hash = ?, refresh_token = NULL WHERE id = ?", [
      passwordHash,
      userId
    ]);
  } finally {
    conn.release();
  }
};

const updateProfileById = async (userId, payload) => {
  const conn = await pool.getConnection();
  try {
    const fields = [];
    const values = [];

    if (typeof payload.fullName === "string") {
      fields.push("full_name = ?");
      values.push(payload.fullName);
    }

    if (typeof payload.avatarUrl === "string") {
      fields.push("avatar_url = ?");
      values.push(payload.avatarUrl);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "dateOfBirth")) {
      fields.push("date_of_birth = ?");
      values.push(payload.dateOfBirth || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "gender")) {
      fields.push("gender = ?");
      values.push(payload.gender || null);
    }

    if (!fields.length) {
      return findUserById(userId);
    }

    values.push(userId);
    await conn.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    return findUserById(userId);
  } finally {
    conn.release();
  }
};

module.exports = {
  ensureUserSchema,
  findUserByEmail,
  findUserByPhone,
  findUserByEmailOrPhone,
  findUserById,
  createUser,
  updateRefreshToken,
  saveVerificationCode,
  verifyUserByCode,
  saveResetCode,
  resetPasswordByCode,
  updatePasswordById,
  updateProfileById
};
