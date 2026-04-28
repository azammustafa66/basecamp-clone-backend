import type { Request } from 'express';
import type { Document, Types } from 'mongoose';

export interface IUser extends Document {
  avatar: { url: string; localPath: string };
  userName: string;
  email: string;
  fullName?: string;
  password: string;
  role: string;
  isEmailVerified: boolean;
  refreshToken?: string;
  forgotPasswordToken?: string;
  forgotPasswordExpiry?: Date;
  emailVerificationToken?: string;
  emailVerificationExpiry?: Date;

  isPasswordCorrect(password: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
  generateTemporaryToken(): { unhashedToken: string; hashedToken: string; tempTokenExpiry: Date };
}

export interface IProject extends Document {
  name: string;
  description: string;
  createdBy: Types.ObjectId[];
}

export interface IProjectMember extends Document {
  user: Types.ObjectId;
  project: Types.ObjectId;
  role: String;
}

export interface ITask extends Document {
  title: string;
  description: string;
  project: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedTo: Types.ObjectId[];
  status: string;
  attachments: [
    {
      url: string;
      mimeType: string;
      size: Number;
    },
  ];
}

export interface ISubTask extends Document {
  title: string;
  task: Types.ObjectId;
  isCompleted: boolean;
  createdBy: Types.ObjectId;
}

export interface INotes extends Document {
  project: Types.ObjectId;
  createdBy: Types.ObjectId;
  content: string;
}

export type MailContent = {
  body: {
    name: string;
    intro: string;
    action?: {
      instructions: string;
      button: {
        color: string;
        text: string;
        link: string;
      };
    };
    outro: string;
  };
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type TemporaryToken = {
  unhashedToken: string;
  hashedToken: string;
  tempTokenExpiry: Date;
};

export type DecodedToken = {
  _id: string;
};

export interface AuthenticatedRequest extends Request {
  user: IUser;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  mailgenContent: MailContent;
}
