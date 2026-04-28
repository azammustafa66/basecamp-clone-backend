# Product Requirements Document — Basecamp Clone

## 1. Overview

A backend API for a collaborative project management tool modelled after Basecamp. Teams can organise work into projects, break projects down into tasks, track progress through subtasks, and communicate through shared notes — all with email notifications keeping everyone in the loop.

---

## 2. Goals

- Provide a clean, secure REST API that a frontend or mobile client can consume.
- Support multi-user collaboration with role-based permissions scoped per project.
- Keep users informed of activity through async email notifications without blocking API responses.
- Be production-deployable from day one with structured logging, graceful shutdown, and environment-based configuration.

---

## 3. User Personas

**Team Member**
Creates an account, joins projects they are invited to, creates and works on tasks they are assigned to, adds notes, and tracks progress via subtasks.

**Project Admin**
Creates projects, invites and removes members, assigns roles, updates project details, and manages all tasks within their projects.

---

## 4. Functional Requirements

### 4.1 Authentication

| # | Requirement |
| --- | --- |
| F-01 | Users can register with a username, email, and password. |
| F-02 | Registered users receive an email with a verification link. Verification tokens expire after 24 hours. |
| F-03 | Users can log in with email or username and receive a short-lived access token and a long-lived refresh token. |
| F-04 | Access tokens can be refreshed using a valid refresh token. Refresh tokens are rotated on every use (reuse detection). |
| F-05 | Users can log out; the refresh token is invalidated server-side. |
| F-06 | Users can request a password reset link via email. The link is single-use and expires after 24 hours. The API always returns 200 for this request to prevent email enumeration. |
| F-07 | Users can reset their password via the token from the reset link. |
| F-08 | Logged-in users can change their password by providing their current password. |
| F-09 | Logged-in users can request a new verification email if they have not yet verified. |

### 4.2 Projects

| # | Requirement |
| --- | --- |
| F-10 | Authenticated users can create a project. The creator is automatically assigned the `admin` role in that project. |
| F-11 | A project can have multiple admins. |
| F-12 | Users can only see projects they are a member of. |
| F-13 | Admins can update a project's name and description. All project admins are notified by email. |
| F-14 | Admins can delete a project. All project membership records are removed. The deleting admin receives a confirmation email. |
| F-15 | Admins can add multiple members at once, specifying a role (`admin` or `member`) per user. Each new member receives a welcome email. |
| F-16 | Admins can remove members. An admin cannot remove themselves. |
| F-17 | Admins can update a member's role. Admins cannot change their own role. Users promoted to `admin` receive a notification email. |
| F-18 | Any project member can view the member list. |

### 4.3 Tasks

| # | Requirement |
| --- | --- |
| F-19 | Any project member can create a task. The task creator becomes the assigner. |
| F-20 | Tasks can be assigned to multiple project members. Each assignee receives an email notification. |
| F-21 | Tasks have a status: `todo`, `inProgress`, or `done`. |
| F-22 | Tasks can include file attachments (url, mimeType, size). |
| F-23 | Only the task assigner, an assignee, or a project admin can update a task. |
| F-24 | When a task's status changes, all current assignees are notified by email. |
| F-25 | When new assignees are added to a task, only the newly added users are notified. Existing assignees are not re-notified. |
| F-26 | Only the task creator or a project admin can delete a task. |
| F-27 | Deleting a task cascades to delete all of its subtasks. All assignees are notified by email. |
| F-28 | Any project member can view all tasks in a project. |

### 4.4 Subtasks

| # | Requirement |
| --- | --- |
| F-29 | Any user who is a task assigner, assignee, or project admin can create and view subtasks. |
| F-30 | Any task-level authorised user can update a subtask's title or toggle its completion. |
| F-31 | Only the subtask creator or a project admin can delete a subtask. |

### 4.5 Notes

| # | Requirement |
| --- | --- |
| F-32 | Any project member can create and view notes within a project. |
| F-33 | Only the note author or a project admin can update or delete a note. |

---

## 5. Non-Functional Requirements

| # | Requirement |
| --- | --- |
| NF-01 | All passwords are hashed with bcrypt (salt rounds: 10) before storage. |
| NF-02 | Email verification and password reset tokens are stored as SHA-256 hashes. The raw token is only ever sent in the email link — never persisted. |
| NF-03 | Sensitive fields (password, refresh token, verification tokens) are never returned in API responses. |
| NF-04 | Email delivery is handled asynchronously via a BullMQ worker. Failed jobs are retried up to 3 times with exponential backoff starting at 3 seconds. |
| NF-05 | The server performs graceful shutdown — the BullMQ worker finishes any in-flight job before the process exits. |
| NF-06 | All application events (requests, errors, auth failures, email delivery) are logged with Winston. Logs are written to file in production. |
| NF-07 | The API returns consistent shaped responses: `{ statusCode, success, message, data }` for success and `{ statusCode, success, message, errors }` for errors. |
| NF-08 | The full API is documented via Swagger UI (OpenAPI 3.0) at `/api/v1/docs`. |

---

## 6. Data Models

### User
```
userName        String (unique, indexed)
email           String (unique)
fullName        String (optional)
password        String (bcrypt hashed)
role            String (global role)
isEmailVerified Boolean
avatar          { url, localPath }
refreshToken    String (hashed, nullable)
forgotPasswordToken       String (hashed, nullable)
forgotPasswordExpiry      Date (nullable)
emailVerificationToken    String (hashed, nullable)
emailVerificationExpiry   Date (nullable)
```

### Project
```
name        String
description String
createdBy   ObjectId[] → User   (array supports multiple admins)
```

### ProjectMember
```
user        ObjectId → User
project     ObjectId → Project
role        String (admin | member)
```

### Task
```
title       String
description String
project     ObjectId → Project
assignedBy  ObjectId → User
assignedTo  ObjectId[] → User
status      String (todo | inProgress | done)
attachments [{ url, mimeType, size }]
```

### SubTask
```
title       String
task        ObjectId → Task
isCompleted Boolean
createdBy   ObjectId → User
```

### Note
```
project     ObjectId → Project
createdBy   ObjectId → User
content     String
```

---

## 7. Permission Model

Roles are **project-scoped**. A user's global role is overwritten with their project-scoped role by the `validateProjectPermission` middleware on every project route.

| Action | admin | member |
| --- | --- | --- |
| View projects / members / tasks / notes | Yes | Yes |
| Create task / note | Yes | Yes |
| Update / delete own note | Yes | Yes |
| Update task (assigner or assignee) | Yes | Yes |
| Update project | Yes | No |
| Delete project | Yes | No |
| Add / remove / update members | Yes | No |
| Delete any task | Yes | No |
| Delete subtask they did not create | Yes | No |

---

## 8. Email Notification Summary

| Trigger | Recipient(s) |
| --- | --- |
| User registers | Registering user |
| User requests password reset | User (if account exists) |
| Project created | Creator |
| Project updated | All project admins |
| Project deleted | Deleting admin |
| Member added to project | Each added user |
| Member promoted to admin | Promoted user |
| Task created with assignees | Each assignee |
| Task status updated | All current assignees |
| New assignees added to task | Newly added users only |
| Task deleted | All assignees at time of deletion |

---

## 9. Out of Scope (v1)

- Real-time notifications (WebSocket / SSE)
- File upload storage (S3 / Cloudinary) — attachment metadata is accepted but upload handling is not implemented
- Direct messaging between users
- Activity feed / audit log
- Frontend / mobile client
