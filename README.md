# Basecamp Clone — Backend API

A RESTful backend for a project management tool inspired by Basecamp. Built with **Express**, **TypeScript**, **Bun**, and **MongoDB**.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Bun |
| Framework | Express 4 |
| Language | TypeScript (strict mode) |
| Database | MongoDB via Mongoose 9 |
| Auth | JWT (access + refresh token rotation) |
| Email | Nodemailer + Mailgen |
| Queue | BullMQ + Redis |
| Docs | Swagger UI (OpenAPI 3.0) |
| Logging | Winston |

---

## Prerequisites

- [Bun](https://bun.sh) >= 1.3
- MongoDB instance (local or Atlas)
- Redis instance (local or remote — port-forward supported)
- SMTP credentials (Mailtrap, SendGrid, etc.)

---

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `PORT` | Server port (default `3000`) |
| `MONGODB_URI` | MongoDB connection string |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `ACCESS_TOKEN_SECRET` | Secret for signing access JWTs |
| `ACCESS_TOKEN_EXPIRY` | e.g. `15m` |
| `REFRESH_TOKEN_SECRET` | Secret for signing refresh JWTs |
| `REFRESH_TOKEN_EXPIRY` | e.g. `7d` |
| `REDIS_HOST` | Redis host (default `127.0.0.1`) |
| `REDIS_PORT` | Redis port (default `6000`) |
| `MAIL_HOST` | SMTP host |
| `MAIL_PORT` | SMTP port |
| `MAIL_USERNAME` | SMTP username |
| `MAIL_PASSWORD` | SMTP password |
| `NODE_ENV` | `development` or `production` |

### 3. Run the server

```bash
# Development (hot reload)
bun run dev

# Production
bun run start
```

The server starts at `http://localhost:3000`.

---

## API Documentation

Interactive Swagger UI is available at:

```
http://localhost:3000/api/v1/docs
```

Paste your access token into the **Authorize** button (top right) to test protected routes directly.

---

## API Overview

All routes are prefixed with `/api/v1`.

### Auth — `/auth`

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/register` | Public | Register a new user |
| POST | `/login` | Public | Login, returns access + refresh tokens |
| POST | `/logout` | JWT | Logout, clears tokens |
| POST | `/refresh-token` | JWT | Rotate access + refresh tokens |
| GET | `/verify-email/:token` | Public | Verify email from link |
| POST | `/resend-email-verification` | JWT | Re-send verification email |
| POST | `/forgot-password` | Public | Request password reset link |
| POST | `/reset-password/:token` | Public | Reset password via email link |
| POST | `/change-password` | JWT | Change password (requires old password) |

### Projects — `/project`

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | Member | List all projects for current user |
| POST | `/` | JWT | Create a new project |
| PATCH | `/:projectId` | Admin | Update project name/description |
| DELETE | `/:projectId` | Admin | Delete project and all members |
| GET | `/:projectId/members` | Member | List project members |
| POST | `/:projectId/members` | Admin | Add members with roles |
| PATCH | `/:projectId/members/:userId` | Admin | Update a member's role |
| DELETE | `/:projectId/members/:userId` | Admin | Remove members |

### Tasks — `/project/:projectId`

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/task` | Member | List all tasks in a project |
| POST | `/task` | Member | Create a task |
| PATCH | `/:taskId` | Assigner / Assignee / Admin | Update a task |
| DELETE | `/:taskId` | Creator / Admin | Delete a task (cascades subtasks) |

### Subtasks — `/project/:projectId/:taskId`

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/subtask` | Task member | List subtasks |
| POST | `/subtask` | Task member | Create a subtask |
| PATCH | `/subtask/:subtaskId` | Task member | Update title or completion |
| DELETE | `/subtask/:subtaskId` | Creator / Admin | Delete a subtask |

### Notes — `/project/:projectId`

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/notes` | Member | List project notes |
| POST | `/notes` | Member | Create a note |
| PATCH | `/notes/:noteId` | Author / Admin | Update note content |
| DELETE | `/notes/:noteId` | Author / Admin | Delete a note |

---

## Permission Model

Roles are **project-scoped** — a user can be admin in one project and member in another.

| Role | Assigned by | Can do |
| --- | --- | --- |
| `admin` | Creator or other admin | Full project control — update/delete project, manage members, all task operations |
| `member` | Admin | Create tasks, update tasks they are assigned to |

The creator of a project is automatically assigned `admin`.

---

## Email Notifications

All emails are processed asynchronously through a **BullMQ** queue backed by Redis. The worker retries failed jobs up to **3 times** with exponential backoff.

| Event | Recipients |
| --- | --- |
| Registration | User (verification link) |
| Forgot password | User (reset link) |
| Project created | Creator |
| Project updated | All admins |
| Project deleted | Creator |
| Member added | Each new member |
| Member promoted to admin | Promoted user |
| Task assigned | Each assignee |
| Task status changed | All current assignees |
| New assignee added to task | Newly added assignees only |
| Task deleted | All assignees |

---

## Project Structure

```
src/
├── config/
│   └── swagger.ts              # OpenAPI spec config
├── controllers/
│   ├── auth.controller.ts
│   ├── notes.controller.ts
│   ├── project.controller.ts
│   ├── subtask.controller.ts
│   └── task.controller.ts
├── db/
│   └── index.ts                # MongoDB connection
├── jobs/
│   └── emailQueue.ts           # BullMQ queue + worker
├── middlewares/
│   ├── auth.middleware.ts      # verifyJWT, validateProjectPermission, validateTaskPermission
│   └── validator.middleware.ts
├── models/
│   ├── user.model.ts
│   ├── project.model.ts
│   ├── projectmember.model.ts
│   ├── task.model.ts
│   ├── subtask.model.ts
│   └── notes.model.ts
├── routes/
│   ├── index.ts
│   ├── auth.route.ts
│   ├── project.route.ts
│   ├── task.route.ts
│   └── notes.route.ts
├── types/
│   └── types.ts
├── utils/
│   ├── apiError.ts
│   ├── apiResponse.ts
│   ├── asyncHandler.ts
│   ├── constants.ts
│   ├── logger.ts
│   └── mail.ts
├── validators/
│   └── index.ts
└── app.ts
index.ts                        # Entry point + graceful shutdown
```

---

## Scripts

```bash
bun run dev      # Hot-reload development server
bun run start    # Production server
```

---

## Logging

Logs are written to:

- **Console** — colorized, development-friendly
- **`logs/error.log`** — errors only
- **`logs/combined.log`** — all levels

Log level is controlled by `NODE_ENV` (`debug` in development, `info` in production).
