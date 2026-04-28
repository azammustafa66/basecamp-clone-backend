// src/validators/index.ts
import { body } from 'express-validator';

// ==========================================
// BASE VALIDATORS (The Lego Blocks)
// ==========================================

export const validateEmail = body('email')
  .trim()
  .notEmpty()
  .withMessage('Email is required')
  .isEmail()
  .withMessage('Not a valid email address');

export const validatePassword = body('password')
  .trim()
  .notEmpty()
  .withMessage('Password is required')
  .isLength({ min: 8, max: 16 })
  .withMessage('Password must be minimum 8 chars long and maximum 16');

export const validateUserName = body('userName')
  .trim()
  .notEmpty()
  .withMessage('Username is required')
  .isLowercase()
  .withMessage('Username must be in lowercase')
  .isLength({ min: 3 })
  .withMessage('Username must at least 3 characters long');

export const validateFullName = body('fullName')
  .optional()
  .trim()
  .notEmpty()
  .withMessage('Full name cannot be empty');

export const validateOptionalUserName = body('userName')
  .optional()
  .trim()
  .notEmpty()
  .withMessage('Username cannot be empty or leave it blank');

export const validateOldPassword = body('oldPassword')
  .trim()
  .notEmpty()
  .withMessage('Old password is required');

export const validateNewPassword = body('newPassword')
  .trim()
  .notEmpty()
  .withMessage('New password is required')
  .isLength({ min: 8, max: 16 })
  .withMessage('New password must be between 8 and 16 characters long');

// ==========================================
// COMPOSED VALIDATORS (The Grouped Blocks)
// ==========================================

export const userRegisterValidator = [
  validateEmail,
  validateUserName,
  validatePassword,
  validateFullName,
];

export const userLoginValidator = [validateEmail, validatePassword, validateOptionalUserName];

export const userChangePasswordValidator = [validateOldPassword, validateNewPassword];
