import Mailgen from 'mailgen';
import nodemailer from 'nodemailer';

import logger from './logger';
import type { MailContent, SendEmailOptions } from '../types/types';

// ─── Sender ───────────────────────────────────────────────────────────────────

export async function sendEmail(options: SendEmailOptions) {
  try {
    // 1. Initialize Mailgen
    const mailGenerator = new Mailgen({
      theme: 'default',
      product: {
        name: 'Task Manager',
        link: 'https://example.com',
      },
    });

    // 2. Generate the email content
    const emailText = mailGenerator.generatePlaintext(options.mailgenContent);
    const emailHTML = mailGenerator.generate(options.mailgenContent);

    // 3. Configure Nodemailer Transporter (e.g., Mailtrap, SendGrid, AWS SES)
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    // 4. Send the email
    const info = await transporter.sendMail({
      from: `"Task Manager Team" <noreply@example.com>`, // Sender address
      to: options.to, // List of receivers
      subject: options.subject, // Subject line
      text: emailText, // Plain text body
      html: emailHTML, // HTML body
    });

    logger.info(`Email sent successfully to ${options.to} (Message ID: ${info.messageId})`);
  } catch (error: any) {
    logger.error(`Failed to send email to ${options.to}: ${error.message}`);
    throw new Error('Email delivery failed');
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export function emailVerificationContent(userName: string, verificationURL: string): MailContent {
  return {
    body: {
      name: userName,
      intro: 'Welcome to our app. We are excited to have you here.',
      action: {
        instructions: 'To verify your email please click on the following button',
        button: {
          color: '#26cf6f',
          text: 'Verify E-mail',
          link: verificationURL,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email , we'd love to speak with you.",
    },
  };
}

export function forgotPasswordMailContent(userName: string, passwordResetURL: string): MailContent {
  return {
    body: {
      name: userName,
      intro: `Hey ${userName},\nWe got a request from your side to reset password.`,
      action: {
        instructions: 'To reset your password please click on the following button',
        button: {
          color: '#c68112',
          text: 'Reset Password',
          link: passwordResetURL,
        },
      },
      outro: 'Please ignore this email if you have not requested to reset your password',
    },
  };
}

export function newProjectCreatedMailContent(
  userName: string,
  projectName: string,
  passwordResetURL: string,
): MailContent {
  return {
    body: {
      name: userName,
      intro: `Hey, ${userName}, \n You have successfully created a ${projectName} as a new project.`,
      outro: `If you did not create this project, reset your password immediately using the button below or contact us.`,
      action: {
        instructions: 'Click the button below to reset your password:',
        button: {
          color: '#c68112',
          text: 'Reset Password',
          link: passwordResetURL,
        },
      },
    },
  };
}

export function projectDeletedMailContent(
  userName: string,
  deletedProjectName: string,
  passwordResetURL: string,
): MailContent {
  return {
    body: {
      name: userName,
      intro: `Hey, ${userName}, \n You have successfully deleted ${deletedProjectName}.`,
      outro:
        "If you believe you've not done this please change your passwords and contact our database adminstrators or customer care.",
      action: {
        instructions: 'Click the button below to reset your password:',
        button: {
          color: '#c68112',
          text: 'Reset Password',
          link: passwordResetURL,
        },
      },
    },
  };
}

export function projectUpdatedMailContent(
  adminName: string,
  projectName: string,
  changes: Record<string, string>,
): MailContent {
  const changeList = Object.entries(changes)
    .map(([field, value]) => `• ${field}: "${value}"`)
    .join('\n');

  return {
    body: {
      name: adminName,
      intro: `The project "${projectName}" has been updated with the following changes:\n\n${changeList}`,
      outro: 'No action is required. This is an automated notification.',
      action: {
        instructions: '',
        button: { color: '#3b82f6', text: 'View Project', link: '#' },
      },
    },
  };
}

export function memberAddedToProjectMailContent(
  userName: string,
  projectName: string,
  role: string,
): MailContent {
  return {
    body: {
      name: userName,
      intro: `You have been added to the project "${projectName}" as a ${role}.`,
      outro: 'Start collaborating with your team right away.',
      action: {
        instructions: 'Log in to get started:',
        button: { color: '#26cf6f', text: 'Go to Project', link: '#' },
      },
    },
  };
}

export function promotedToAdminMailContent(userName: string, projectName: string): MailContent {
  return {
    body: {
      name: userName,
      intro: `You have been promoted to Admin in the project "${projectName}".`,
      outro: 'You can now manage members and settings for this project.',
      action: {
        instructions: 'Log in to manage your project:',
        button: { color: '#f59e0b', text: 'Go to Project', link: '#' },
      },
    },
  };
}

export function taskAssignedMailContent(
  userName: string,
  taskTitle: string,
  projectName: string,
): MailContent {
  return {
    body: {
      name: userName,
      intro: `You have been assigned to the task "${taskTitle}" in project "${projectName}".`,
      outro: 'Log in to view your task details and get started.',
      action: {
        instructions: 'View your task:',
        button: { color: '#6366f1', text: 'View Task', link: '#' },
      },
    },
  };
}

export function taskStatusUpdatedMailContent(
  userName: string,
  taskTitle: string,
  newStatus: string,
): MailContent {
  return {
    body: {
      name: userName,
      intro: `The status of task "${taskTitle}" has been updated to "${newStatus}".`,
      outro: 'Log in to see the latest changes.',
      action: {
        instructions: 'View the task:',
        button: { color: '#0ea5e9', text: 'View Task', link: '#' },
      },
    },
  };
}

export function taskDeletedMailContent(
  userName: string,
  taskTitle: string,
  projectName: string,
): MailContent {
  return {
    body: {
      name: userName,
      intro: `The task "${taskTitle}" in project "${projectName}" has been deleted.`,
      outro: 'If this was unexpected, please contact your project admin.',
      action: {
        instructions: '',
        button: { color: '#ef4444', text: 'Go to Project', link: '#' },
      },
    },
  };
}
