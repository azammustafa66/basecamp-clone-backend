// ─── User Roles ───────────────────────────────────────────────────────────────

export const UserRoles = {
  ADMIN: 'admin',
  PROJECT_ADMIN: 'projectAdmin',
  MEMBER: 'member',
};

export const AvailableUserRoles = Object.values(UserRoles);

// ─── Task Status ──────────────────────────────────────────────────────────────

export const TaskStatus = {
  TODO: 'todo',
  IN_PROGRESS: 'inProgress',
  DONE: 'done',
};

export const AvailableTaskStatus = Object.values(TaskStatus);
