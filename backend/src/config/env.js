const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: (process.env.NODE_ENV || "development").trim(),
  db: {
    host: (process.env.DB_HOST || "localhost").trim(),
    port: Number(process.env.DB_PORT || 3306),
    user: (process.env.DB_USER || "root").trim(),
    password: process.env.DB_PASSWORD || "123456",
    name: (process.env.DB_NAME || "zalo_app").trim()
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "dev_access_secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d"
  },
  auth: {
    requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "false",
    exposeDebugCodes:
      process.env.AUTH_EXPOSE_DEBUG_CODES === "true" ||
      (process.env.NODE_ENV || "development") !== "production"
  },
  otp: {
    smtpHost: (process.env.OTP_SMTP_HOST || "").trim(),
    smtpPort: Number(process.env.OTP_SMTP_PORT || 587),
    smtpSecure: process.env.OTP_SMTP_SECURE === "true",
    smtpUser: (process.env.OTP_SMTP_USER || "").trim(),
    smtpPass: (process.env.OTP_SMTP_PASS || "").trim(),
    smtpFrom: (process.env.OTP_SMTP_FROM || "").trim(),
    twilioSid: (process.env.OTP_TWILIO_SID || "").trim(),
    twilioToken: (process.env.OTP_TWILIO_AUTH_TOKEN || "").trim(),
    twilioFrom: (process.env.OTP_TWILIO_FROM || "").trim()
  },
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:19006")
    .split(",")
    .map((origin) => origin.trim()),
  aws: {
    region: process.env.AWS_REGION || "ap-southeast-1",
    bucket: process.env.AWS_S3_BUCKET || "",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  }
};

module.exports = env;
