const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const {
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
} = require("../controllers/auth.controller");

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, fullName, password]
 *             properties:
 *               email:
 *                 type: string
 *               fullName:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Register success
 */
router.post("/register", register);
router.post("/verify-registration", verifyRegistration);
router.post("/resend-verification", resendVerificationCode);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 */
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 */
router.post("/refresh", refreshToken);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     tags: [Auth]
 *     summary: Get current user profile
 */
router.get("/me", authMiddleware, me);
router.put("/me", authMiddleware, updateProfile);
router.post("/change-password", authMiddleware, changePassword);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     tags: [Auth]
 *     summary: Logout and invalidate refresh token
 */
router.post("/logout", authMiddleware, logout);

/**
 * @swagger
 * /api/auth/avatar-upload-url:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     tags: [Auth]
 *     summary: Create S3 pre-signed upload URL for avatar
 */
router.post("/avatar-upload-url", authMiddleware, getAvatarUploadUrl);
router.post("/avatar-upload-base64", authMiddleware, uploadAvatarBase64);

module.exports = router;
