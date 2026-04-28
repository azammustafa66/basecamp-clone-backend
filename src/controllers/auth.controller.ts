import crypto from 'crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { User } from '../models/index';
import type { AuthenticatedRequest, DecodedToken } from '../types/types';
import {
  APIError,
  APIResponse,
  asyncHandler,
  emailVerificationContent,
  forgotPasswordMailContent,
  logger,
} from '../utils/index';
import { emailQueue } from '../jobs/emailQueue';
import { UserRoles } from '../utils/constants';

// ─── Cookie Config ────────────────────────────────────────────────────────────

const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function generateAccessAndRefreshTokens(userId: string) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.error('User not found');
      throw new APIError(404, 'User not found');
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    // Skip validation — we're only updating the refreshToken field, not user-submitted data
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error(error);
    throw new APIError(500, 'Something went wrong will generating tokens');
  }
}

// ─── Registration & Email Verification ───────────────────────────────────────

export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { userName, email, password } = req.body;

  const existingUser = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (existingUser) {
    throw new APIError(409, 'username/email already exists', []);
  }

  const user = await User.create({
    userName,
    email,
    password,
    role: UserRoles.MEMBER,
    isEmailVerified: false,
  });

  const { unhashedToken, hashedToken, tempTokenExpiry } = user.generateTemporaryToken();
  // Store only the hashed token in DB; send the raw token in the email link for security
  user.emailVerificationExpiry = tempTokenExpiry;
  user.emailVerificationToken = hashedToken;
  // Skip validation — password is already hashed, re-hashing would corrupt it
  await user.save({ validateBeforeSave: false });

  await emailQueue.add('SendVerificationMail', {
    to: user.email,
    subject: 'Please verify your email',
    mailgenContent: emailVerificationContent(
      user.userName,
      `${req.protocol}://${req.get('host')}/api/v1/users/verify-email/${unhashedToken}`,
    ),
  });

  // Re-fetch to get a clean object with sensitive fields stripped before sending in response
  const createdUser = await User.findById(user._id).select(
    '-password -refreshToken -emailVerificationToken -emailVerificationExpiry',
  );
  if (!createdUser) {
    logger.error('Error while registering a user');
    throw new APIError(500, 'Something went wrong while registering a user');
  }

  logger.info(`User registered: ${user.userName} (${user.email})`);
  return res
    .status(201)
    .json(
      new APIResponse(
        201,
        { user: createdUser },
        "Registered successfully, you'll recieve a link to verify your email shortly",
      ),
    );
});

export const verifyEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { verificationToken } = req.params;
  if (!verificationToken) throw new APIError(400, 'Email verification token missing');

  // Hash the incoming token to compare against the stored hash
  const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() }, // token must not be expired
  });

  if (!user) throw new APIError(400, 'Token is invalid or has expired');

  user.isEmailVerified = true;
  // Clear token fields so the same link cannot be reused
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;

  await user.save({ validateBeforeSave: false });

  logger.info(`Email verified for user: ${user.userName}`);
  return res.status(200).json(new APIResponse(200, {}, 'Email verification successfull'));
});

export const resendEmailVerification = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user._id);
    if (!user) throw new APIError(404, 'User not found');

    if (user.isEmailVerified) throw new APIError(400, 'Email already verified');

    const { unhashedToken, hashedToken, tempTokenExpiry } = user.generateTemporaryToken();
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tempTokenExpiry;

    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email/${unhashedToken}`;
    await emailQueue.add('ResendEmailVerification', {
      to: user.email,
      subject: 'Verify your email',
      mailgenContent: emailVerificationContent(user.userName, verificationUrl),
    });

    logger.info(`Verification email resent to: ${user.email}`);
    return res.status(200).json(new APIResponse(200, {}, 'Verification email sent'));
  },
);

// ─── Login & Logout ───────────────────────────────────────────────────────────

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, userName } = req.body;
  if (!email || !password) {
    throw new APIError(422, 'Email/Password cannot be empty');
  }

  // Allow login with either email or username
  const user = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (!user) {
    throw new APIError(404, 'User does exist. Please register then log in.');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    logger.warn(`Failed login attempt for: ${email}`);
    throw new APIError(401, 'Invalid Credentials');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id.toString());
  logger.info(`User logged in: ${user.userName}`);

  // Strip sensitive fields before sending the user object in the response
  const userObject = user.toObject();
  const {
    password: _password,
    refreshToken: _refresh,
    emailVerificationToken,
    emailVerificationExpiry,
    ...safeUser
  } = userObject;

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new APIResponse(
        200,
        { user: safeUser, accessToken: accessToken, refreshToken: refreshToken },
        'Login Successfull',
      ),
    );
});

export const logOutUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Remove the refresh token from DB so it cannot be used again after logout
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
  );

  logger.info(`User logged out: ${req.user._id.toString()}`);
  res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new APIResponse(200, {}, 'User logged out successfully'));
});

// ─── Password Management ──────────────────────────────────────────────────────

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) throw new APIError(400, 'Please provide email');

  const user = await User.findOne({ email });
  if (!user) {
    // Return 200 regardless — avoids leaking whether the email is registered
    return res
      .status(200)
      .json(
        new APIResponse(
          200,
          {},
          'If an account with that email exists, a reset link has been sent.',
        ),
      );
  }
  const { unhashedToken, hashedToken, tempTokenExpiry } = user.generateTemporaryToken();
  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordExpiry = tempTokenExpiry;
  await user.save({ validateBeforeSave: false });

  const resetURL = `${req.protocol}://${req.get('host')}/reset-password/${unhashedToken}`;
  await emailQueue.add('ForgotPasswordMail', {
    to: email,
    subject: 'Reset Password',
    mailgenContent: forgotPasswordMailContent(user.userName, resetURL),
  });

  return res
    .status(200)
    .json(
      new APIResponse(
        200,
        {},
        'A reset link has been sent. Please check your inbox and spam collection',
      ),
    );
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;
  if (!resetToken) throw new APIError(400, 'Email verification token missing');

  // Hash the incoming token to compare against the stored hash
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() }, // token must not be expired
  });

  if (!user) throw new APIError(400, 'Token is invalid or has expired');

  user.password = newPassword;
  // Clear reset fields so the same link cannot be reused
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;
  // save() (not validateBeforeSave: false) triggers the pre-save hook to hash the new password
  await user.save();

  logger.info(`Password reset for user: ${user.userName}`);
  return res
    .status(200)
    .json(new APIResponse(200, {}, 'Password reset successfully. You can now log in.'));
});

export const changeCurrentPassword = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      throw new APIError(400, 'Both old and new passwords are required');
    }

    const user = await User.findById(req.user._id);
    if (!user) throw new APIError(404, 'User not found');

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordValid) throw new APIError(400, 'Incorrect old password');
    if (oldPassword === newPassword) {
      throw new APIError(400, 'New password cannot be the same as the old password');
    }

    user.password = newPassword;
    await user.save();

    logger.info(`Password changed for user: ${user.userName}`);
    return res.status(200).json(new APIResponse(200, {}, 'Password changed successfully'));
  },
);

// ─── Token Refresh ────────────────────────────────────────────────────────────

export const refreshAccessToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.header('Authorization')?.replace('Bearer ', '');
  if (!incomingRefreshToken) throw new APIError(401, 'Invalid refresh token');

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET as string,
    ) as DecodedToken;

    const user = await User.findById(decodedToken._id);

    if (!user) throw new APIError(401, 'Invalid refresh token');

    // Detect refresh token reuse — if the incoming token doesn't match the stored one, it's been rotated already
    if (incomingRefreshToken !== user.refreshToken)
      throw new APIError(401, 'Refresh token expired or used');

    const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(
      decodedToken._id,
    );

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new APIResponse(
          200,
          { accessToken: accessToken, refreshToken: newRefreshToken },
          'Access Token refreshed successfully',
        ),
      );
  } catch (error) {
    logger.warn(`Token refresh failed: ${error}`);
    throw new APIError(401, 'Invalid or expired refresh token');
  }
});
