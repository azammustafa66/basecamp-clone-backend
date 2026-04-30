import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Schema, model } from 'mongoose';

import type { IUser, TemporaryToken } from '../types/types';

// ─── Interface ────────────────────────────────────────────────────────────────

// ─── Schema ───────────────────────────────────────────────────────────────────

const avatarSchema = new Schema(
  {
    url: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    localPath: { type: String, default: '' },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    avatar: { type: avatarSchema, default: () => ({}) },
    userName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: { type: String, trim: true },
    password: { type: String, required: [true, 'Password is required'], trim: true },
    role: { type: String, required: [true, 'Role is required'], trim: true },
    isEmailVerified: { type: Boolean, default: false },
    refreshToken: { type: String },
    forgotPasswordToken: { type: String },
    forgotPasswordExpiry: { type: Date },
    emailVerificationToken: { type: String },
    emailVerificationExpiry: { type: Date },
  },
  { timestamps: true },
);

// ─── Middleware ───────────────────────────────────────────────────────────────

userSchema.pre('save', async function () {
  // Skip hashing if password hasn't changed — avoids double-hashing on unrelated saves
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 10);
});

// ─── Methods ──────────────────────────────────────────────────────────────────

userSchema.method('isPasswordCorrect', async function (password: string) {
  return await bcrypt.compare(password, this.password);
});

userSchema.method('generateAccessToken', function () {
  return jwt.sign(
    {
      _id: this._id.toString(),
      email: this.email,
      userName: this.userName,
    },
    process.env.ACCESS_TOKEN_SECRET as string,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY as any,
    },
  );
});

userSchema.method('generateRefreshToken', function () {
  // Minimal payload — refresh tokens only need to identify the user, not carry profile data
  return jwt.sign(
    {
      _id: this._id.toString(),
    },
    process.env.REFRESH_TOKEN_SECRET as string,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY as any,
    },
  );
});

userSchema.method('generateTemporaryToken', (): TemporaryToken => {
  const unhashedToken = crypto.randomBytes(20).toString('hex');
  // Store only the hash in DB; the raw token goes in the email link so it's never persisted
  const hashedToken = crypto.createHash('sha256').update(unhashedToken).digest('hex');
  const tempTokenExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hrs

  return { unhashedToken, hashedToken, tempTokenExpiry };
});

export const User = model('User', userSchema);
