import { Router } from 'express';

import {
  loginUser,
  logOutUser,
  registerUser,
  refreshAccessToken,
  verifyEmail,
  resendEmailVerification,
  forgotPassword,
  resetPassword,
  changeCurrentPassword,
} from '../controllers/auth.controller';
import {
  validateEmail,
  validatePassword,
  userLoginValidator,
  userRegisterValidator,
  userChangePasswordValidator,
} from '../validators';
import { validate } from '../middlewares/validator.middleware';
import { verifyJWT } from '../middlewares/auth.middleware';

const router = Router();

// ─── Public Routes (No login required) ────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userName, email, password]
 *             properties:
 *               userName: { type: string, example: johndoe }
 *               email: { type: string, example: john@example.com }
 *               password: { type: string, example: Secret@123 }
 *     responses:
 *       201:
 *         description: Registered successfully — verification email sent
 *       409:
 *         description: Username or email already exists
 */
router.route('/register').post(userRegisterValidator, validate, registerUser);
/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: john@example.com }
 *               password: { type: string, example: Secret@123 }
 *     responses:
 *       200:
 *         description: Login successful — returns accessToken and refreshToken
 *       401:
 *         description: Invalid credentials
 */
router.route('/login').post(userLoginValidator, validate, loginUser);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using refresh token
 *     responses:
 *       200:
 *         description: New access and refresh tokens issued
 *       401:
 *         description: Refresh token expired or already used
 */
router.route('/refresh-token').post(verifyJWT, refreshAccessToken);

/**
 * @swagger
 * /auth/verify-email/{verificationToken}:
 *   get:
 *     tags: [Auth]
 *     summary: Verify email address from link in email
 *     security: []
 *     parameters:
 *       - in: path
 *         name: verificationToken
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Token invalid or expired
 */
router.route('/verify-email/:verificationToken').get(verifyEmail);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset link
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: john@example.com }
 *     responses:
 *       200:
 *         description: Reset link sent if account exists (always 200 to avoid email enumeration)
 */
router.route('/forgot-password').post([validateEmail], validate, forgotPassword);

/**
 * @swagger
 * /auth/reset-password/{resetToken}:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using token from email link
 *     security: []
 *     parameters:
 *       - in: path
 *         name: resetToken
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, example: NewSecret@456 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Token invalid or expired
 */
router.route('/reset-password/:resetToken').post([validatePassword], validate, resetPassword);

// ─── Protected Routes (Requires valid JWT cookies) ────────────────────────────

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and invalidate refresh token
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.route('/logout').post(verifyJWT, logOutUser);

/**
 * @swagger
 * /auth/resend-email-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Resend email verification link
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Email already verified
 */
router.route('/resend-email-verification').post(verifyJWT, resendEmailVerification);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (must know old password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Incorrect old password or same as new
 */
router
  .route('/change-password')
  .post(verifyJWT, userChangePasswordValidator, validate, changeCurrentPassword);

export default router;
