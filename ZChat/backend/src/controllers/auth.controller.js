const { GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { z } = require("zod");
const { s3Client, hasAwsConfig } = require("../config/aws");
const env = require("../config/env");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} = require("../config/jwt");
const {
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
} = require("../models/user.model");
const { hashPassword, comparePassword } = require("../utils/password");
const { sendOtp } = require("../utils/otp-delivery");

const PASSWORD_REGEX = /^.{6,72}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const getZodMessage = (error) => error?.issues?.[0]?.message || "Lỗi xác thực dữ liệu";

const registerSchema = z.object({
  emailOrPhone: z.string().min(1, "Vui lòng nhập email hoặc số điện thoại"),
  fullName: z.string().min(2, "Họ tên tối thiểu 2 ký tự").max(120).optional(),
  dateOfBirth: z.string().regex(DATE_REGEX, "Ngày sinh không hợp lệ").optional(),
  gender: z.string().max(20).optional(),
  avatarUrl: z.string().url().max(1024).optional(),
  password: z.string().regex(PASSWORD_REGEX, "Mật khẩu phải từ 6 đến 72 ký tự")
});

const loginSchema = z.object({
  emailOrPhone: z.string().min(1, "Vui lòng nhập email hoặc số điện thoại"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").max(72)
});

const verifyRegistrationSchema = z.object({
  emailOrPhone: z.string(),
  code: z.string().min(4).max(20)
});

const forgotPasswordSchema = z.object({
  emailOrPhone: z.string()
});

const resetPasswordSchema = z.object({
  emailOrPhone: z.string(),
  code: z.string().min(4).max(20),
  newPassword: z.string().regex(PASSWORD_REGEX, "Mật khẩu phải từ 6 đến 72 ký tự")
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại").max(72),
  newPassword: z.string().regex(PASSWORD_REGEX, "Mật khẩu phải từ 6 đến 72 ký tự")
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  avatarUrl: z.string().url().max(1024).optional(),
  dateOfBirth: z.string().regex(DATE_REGEX, "Ngày sinh không hợp lệ").nullable().optional(),
  gender: z.string().max(20).nullable().optional()
});

const avatarBase64Schema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  base64Data: z.string().min(10)
});

const toProfilePayload = (user) => ({
  id: user.id,
  email: user.email,
  phone: user.phone || null,
  fullName: user.full_name,
  dateOfBirth: user.date_of_birth || null,
  gender: user.gender || null,
  avatarUrl: user.avatar_url || null,
  isVerified: Boolean(user.is_verified),
  createdAt: user.created_at
});

const buildAuthPayload = toProfilePayload;

const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
const isPhone = (str) => /^[0-9\-\+\(\) ]{7,}$/.test(str);

const normalizeEmailOrPhone = (input) => {
  const normalized = String(input || "").trim();

  if (isEmail(normalized)) {
    return { email: normalized.toLowerCase(), phone: null };
  }
  if (isPhone(normalized)) {
    return { email: null, phone: normalized.replace(/\s/g, "") };
  }
  throw new Error("Vui lòng nhập email hoặc số điện thoại hợp lệ");
};

const normalizeGender = (value) => {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  if (["male", "nam"].includes(normalized)) return "male";
  if (["female", "nu", "nữ"].includes(normalized)) return "female";
  if (["other", "khac", "khác"].includes(normalized)) return "other";

  throw new Error("Giới tính không hợp lệ. Chỉ chấp nhận male/female/other hoặc nam/nữ/khác");
};

const buildOtpFailurePayload = ({ otpDelivery, code, purpose, identifier }) => {
  if (!env.auth.exposeDebugCodes) {
    return null;
  }

  const codeField = purpose === "reset" ? "resetCode" : "verificationCode";
  return {
    message: "Không gửi được OTP thật. Đang dùng mã demo trong môi trường phát triển.",
    requiresVerification: purpose === "verify",
    emailOrPhone: identifier,
    otpSent: false,
    otpChannel: "debug",
    otpReason: otpDelivery.reason,
    otpError: otpDelivery.error,
    [codeField]: code
  };
};

const createNumericCode = (length = 6) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

const addMinutes = (minutes) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
};

const issueTokens = async (user) => {
  const payload = buildAuthPayload(user);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await updateRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken, user: payload };
};

const register = async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);
    const { email, phone } = normalizeEmailOrPhone(input.emailOrPhone);
    const normalizedGender = normalizeGender(input.gender);

    // Check if user already exists
    let existingUser = null;
    if (email) {
      existingUser = await findUserByEmail(email);
    }
    if (!existingUser && phone) {
      existingUser = await findUserByPhone(phone);
    }

    if (existingUser) {
      return res.status(409).json({ message: "Email hoặc số điện thoại đã tồn tại" });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await createUser({
      email,
      phone,
      fullName: input.fullName || "Người dùng mới",
      dateOfBirth: input.dateOfBirth,
      gender: normalizedGender,
      avatarUrl: input.avatarUrl,
      passwordHash
    });

    if (!env.auth.requireEmailVerification) {
      const connPayload = { ...user, is_verified: 1 };
      const tokenData = await issueTokens(connPayload);
      return res.status(201).json(tokenData);
    }

    const verificationCode = createNumericCode(6);
    const expiresAt = addMinutes(10);
    const identifier = email || phone;
    await saveVerificationCode(identifier, verificationCode, expiresAt);
    const otpDelivery = await sendOtp({ identifier, code: verificationCode, purpose: "verify" });

    if (!otpDelivery.sent) {
      const debugPayload = buildOtpFailurePayload({
        otpDelivery,
        code: verificationCode,
        purpose: "verify",
        identifier
      });

      if (debugPayload) {
        return res.status(201).json(debugPayload);
      }

      return res.status(502).json({
        message: "Không thể gửi OTP. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.",
        otpSent: false,
        otpChannel: otpDelivery.channel,
        otpReason: otpDelivery.reason,
        otpError: env.auth.exposeDebugCodes ? otpDelivery.error : undefined
      });
    }

    return res.status(201).json({
      message: "Đăng ký thành công. Vui lòng xác thực tài khoản bằng mã OTP.",
      requiresVerification: true,
      emailOrPhone: identifier,
      otpSent: otpDelivery.sent,
      otpChannel: otpDelivery.channel,
      otpDestination: otpDelivery.destination,
      otpReason: otpDelivery.reason,
      verificationCode: env.auth.exposeDebugCodes ? verificationCode : undefined
    });
  } catch (error) {
    if (error.message === "Vui lòng nhập email hoặc số điện thoại hợp lệ") {
      return res.status(400).json({ message: error.message });
    }

    if (error.message.startsWith("Giới tính không hợp lệ")) {
      return res.status(400).json({ message: error.message });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({ message: getZodMessage(error), issues: error.issues });
    }

    return res.status(500).json({ message: "Đăng ký thất bại", error: error.message });
  }
};

const verifyRegistration = async (req, res) => {
  try {
    const input = verifyRegistrationSchema.parse(req.body);
    const { email, phone } = normalizeEmailOrPhone(input.emailOrPhone);
    const identifier = email || phone;
    const isValid = await verifyUserByCode(identifier, input.code.trim());

    if (!isValid) {
      return res.status(400).json({ message: "Mã xác thực không hợp lệ hoặc đã hết hạn" });
    }

    const user = await findUserByEmailOrPhone(identifier);

    if (!user) {
      return res.status(404).json({ message: "Tài khoản không tồn tại" });
    }

    const tokenData = await issueTokens(user);
    return res.json({
      message: "Xác thực thành công",
      ...tokenData
    });
  } catch (error) {
    if (error.message === "Vui lòng nhập email hoặc số điện thoại hợp lệ") {
      return res.status(400).json({ message: error.message });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({ message: getZodMessage(error), issues: error.issues });
    }

    return res.status(500).json({ message: "Xác thực thất bại", error: error.message });
  }
};

const resendVerificationCode = async (req, res) => {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    const { email, phone } = normalizeEmailOrPhone(input.emailOrPhone);
    const identifier = email || phone;
    const user = await findUserByEmailOrPhone(identifier);

    if (!user) {
      return res.status(404).json({ message: "Tài khoản không tồn tại" });
    }

    if (user.is_verified) {
      return res.status(400).json({ message: "Tài khoản đã được xác thực" });
    }

    const verificationCode = createNumericCode(6);
    const expiresAt = addMinutes(10);
    await saveVerificationCode(identifier, verificationCode, expiresAt);
    const otpDelivery = await sendOtp({ identifier, code: verificationCode, purpose: "verify" });

    if (!otpDelivery.sent) {
      const debugPayload = buildOtpFailurePayload({
        otpDelivery,
        code: verificationCode,
        purpose: "verify",
        identifier
      });

      if (debugPayload) {
        return res.json(debugPayload);
      }

      return res.status(502).json({
        message: "Không thể gửi OTP. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.",
        otpSent: false,
        otpChannel: otpDelivery.channel,
        otpReason: otpDelivery.reason,
        otpError: env.auth.exposeDebugCodes ? otpDelivery.error : undefined
      });
    }

    return res.json({
      message: "Mã xác thực mới đã được tạo",
      otpSent: otpDelivery.sent,
      otpChannel: otpDelivery.channel,
      otpDestination: otpDelivery.destination,
      otpReason: otpDelivery.reason,
      verificationCode: env.auth.exposeDebugCodes ? verificationCode : undefined
    });
  } catch (error) {
    if (error.message === "Vui lòng nhập email hoặc số điện thoại hợp lệ") {
      return res.status(400).json({ message: error.message });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Lỗi xác thực dữ liệu", issues: error.issues });
    }

    return res.status(500).json({ message: "Gửi lại mã xác thực thất bại", error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await findUserByEmailOrPhone(input.emailOrPhone);

    if (!user) {
      return res.status(401).json({ message: "Email/số điện thoại hoặc mật khẩu không chính xác" });
    }

    if (env.auth.requireEmailVerification && !user.is_verified) {
      return res.status(403).json({ message: "Email hoặc số điện thoại chưa được xác thực" });
    }

    const matched = await comparePassword(input.password, user.password_hash);

    if (!matched) {
      return res.status(401).json({ message: "Email/số điện thoại hoặc mật khẩu không chính xác" });
    }

    const tokenData = await issueTokens(user);
    return res.json(tokenData);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Lỗi xác thực dữ liệu", issues: error.issues });
    }

    return res.status(500).json({ message: "Đăng nhập thất bại", error: error.message });
  }
};

const me = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(toProfilePayload(user));
  } catch (error) {
    return res.status(500).json({ message: "Cannot fetch profile", error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const input = updateProfileSchema.parse(req.body);
    const normalizedGender = Object.prototype.hasOwnProperty.call(input, "gender")
      ? normalizeGender(input.gender)
      : undefined;

    const hasAnyField =
      Object.prototype.hasOwnProperty.call(input, "fullName") ||
      Object.prototype.hasOwnProperty.call(input, "avatarUrl") ||
      Object.prototype.hasOwnProperty.call(input, "dateOfBirth") ||
      Object.prototype.hasOwnProperty.call(input, "gender");

    if (!hasAnyField) {
      return res.status(400).json({ message: "Vui lòng cập nhật ít nhất một thông tin" });
    }

    const user = await updateProfileById(req.user.id, {
      fullName: input.fullName,
      avatarUrl: input.avatarUrl,
      dateOfBirth: input.dateOfBirth,
      gender: normalizedGender
    });

    return res.json({ message: "Cập nhật hồ sơ thành công", user: toProfilePayload(user) });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: getZodMessage(error), issues: error.issues });
    }

    if (error.message.startsWith("Giới tính không hợp lệ")) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "Cập nhật hồ sơ thất bại", error: error.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "refreshToken is required" });
    }

    const decoded = verifyRefreshToken(token);
    const user = await findUserById(decoded.id);

    if (!user || user.refresh_token !== token) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const tokenData = await issueTokens(user);
    return res.json(tokenData);
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

const logout = async (req, res) => {
  try {
    await updateRefreshToken(req.user.id, null);
    return res.json({ message: "Logged out" });
  } catch (error) {
    return res.status(500).json({ message: "Logout failed", error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    const { email, phone } = normalizeEmailOrPhone(input.emailOrPhone);
    const identifier = email || phone;
    const user = await findUserByEmailOrPhone(identifier);

    if (!user) {
      return res.json({ message: "Nếu tài khoản tồn tại, mã đặt lại mật khẩu đã được gửi" });
    }

    const resetCode = createNumericCode(6);
    const expiresAt = addMinutes(10);
    await saveResetCode(identifier, resetCode, expiresAt);
    const otpDelivery = await sendOtp({ identifier, code: resetCode, purpose: "reset" });

    if (!otpDelivery.sent) {
      const debugPayload = buildOtpFailurePayload({
        otpDelivery,
        code: resetCode,
        purpose: "reset",
        identifier
      });

      if (debugPayload) {
        return res.json(debugPayload);
      }

      return res.status(502).json({
        message: "Không thể gửi mã đặt lại mật khẩu. Vui lòng kiểm tra cấu hình Email/SMS và thử lại.",
        otpSent: false,
        otpChannel: otpDelivery.channel,
        otpReason: otpDelivery.reason,
        otpError: env.auth.exposeDebugCodes ? otpDelivery.error : undefined
      });
    }

    return res.json({
      message: "Mã đặt lại mật khẩu đã được tạo",
      otpSent: otpDelivery.sent,
      otpChannel: otpDelivery.channel,
      otpDestination: otpDelivery.destination,
      otpReason: otpDelivery.reason,
      resetCode: env.auth.exposeDebugCodes ? resetCode : undefined
    });
  } catch (error) {
    if (error.message === "Vui lòng nhập email hoặc số điện thoại hợp lệ") {
      return res.status(400).json({ message: error.message });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Lỗi xác thực dữ liệu", issues: error.issues });
    }

    return res.status(500).json({ message: "Quên mật khẩu thất bại", error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const input = resetPasswordSchema.parse(req.body);
    const { email, phone } = normalizeEmailOrPhone(input.emailOrPhone);
    const identifier = email || phone;
    const passwordHash = await hashPassword(input.newPassword);
    const updated = await resetPasswordByCode(identifier, input.code.trim(), passwordHash);

    if (!updated) {
      return res.status(400).json({ message: "Mã đặt lại không hợp lệ hoặc đã hết hạn" });
    }

    return res.json({ message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    if (error.message === "Vui lòng nhập email hoặc số điện thoại hợp lệ") {
      return res.status(400).json({ message: error.message });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Lỗi xác thực dữ liệu", issues: error.issues });
    }

    return res.status(500).json({ message: "Đặt lại mật khẩu thất bại", error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const input = changePasswordSchema.parse(req.body);

    if (input.currentPassword === input.newPassword) {
      return res.status(400).json({ message: "Mật khẩu mới phải khác mật khẩu hiện tại" });
    }

    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Tài khoản không tồn tại" });
    }

    const matched = await comparePassword(input.currentPassword, user.password_hash);

    if (!matched) {
      return res.status(401).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    const passwordHash = await hashPassword(input.newPassword);
    await updatePasswordById(req.user.id, passwordHash);

    return res.json({ message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại" });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: getZodMessage(error), issues: error.issues });
    }

    return res.status(500).json({ message: "Đổi mật khẩu thất bại", error: error.message });
  }
};

const getAvatarUploadUrl = async (req, res) => {
  try {
    if (!hasAwsConfig || !s3Client) {
      return res.status(400).json({ message: "AWS S3 is not configured" });
    }

    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      return res.status(400).json({ message: "fileName and contentType are required" });
    }

    const objectKey = `avatars/${req.user.id}/${Date.now()}-${fileName}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: env.aws.bucket,
      Key: objectKey,
      ContentType: contentType
    });

    const signedUploadUrl = await getSignedUrl(s3Client, uploadCommand, { expiresIn: 300 });

    const readCommand = new GetObjectCommand({
      Bucket: env.aws.bucket,
      Key: objectKey
    });

    const signedReadUrl = await getSignedUrl(s3Client, readCommand, { expiresIn: 3600 });
    const mediaUrl = `https://${env.aws.bucket}.s3.${env.aws.region}.amazonaws.com/${objectKey}`;

    return res.json({ signedUploadUrl, signedReadUrl, mediaUrl, key: objectKey });
  } catch (error) {
    return res.status(500).json({ message: "Cannot create pre-signed URL", error: error.message });
  }
};

const uploadAvatarBase64 = async (req, res) => {
  try {
    if (!hasAwsConfig || !s3Client) {
      return res.status(400).json({ message: "AWS S3 is not configured" });
    }

    const input = avatarBase64Schema.parse(req.body);
    const objectKey = `avatars/${req.user.id}/${Date.now()}-${input.fileName}`;
    const payload = input.base64Data.replace(/^data:[^;]+;base64,/, "");
    const bodyBuffer = Buffer.from(payload, "base64");

    const uploadCommand = new PutObjectCommand({
      Bucket: env.aws.bucket,
      Key: objectKey,
      ContentType: input.contentType,
      Body: bodyBuffer
    });

    await s3Client.send(uploadCommand);

    const readCommand = new GetObjectCommand({
      Bucket: env.aws.bucket,
      Key: objectKey
    });
    const signedReadUrl = await getSignedUrl(s3Client, readCommand, { expiresIn: 3600 });
    const mediaUrl = `https://${env.aws.bucket}.s3.${env.aws.region}.amazonaws.com/${objectKey}`;

    return res.json({ message: "Avatar uploaded", mediaUrl, signedReadUrl, key: objectKey });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: getZodMessage(error), issues: error.issues });
    }

    return res.status(500).json({ message: "Cannot upload avatar", error: error.message });
  }
};

module.exports = {
  register,
  verifyRegistration,
  resendVerificationCode,
  login,
  me,
  updateProfile,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getAvatarUploadUrl,
  uploadAvatarBase64
};
