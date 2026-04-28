import type { Response } from 'express';

import { Task, SubTask, Project, User } from '../models/index';
import type { AuthenticatedRequest } from '../types/types';
import {
  asyncHandler,
  APIError,
  APIResponse,
  logger,
  taskAssignedMailContent,
  taskStatusUpdatedMailContent,
  taskDeletedMailContent,
} from '../utils';
import { TaskStatus, UserRoles } from '../utils/constants';
import { emailQueue } from '../jobs/emailQueue';

// ─── Task CRUD ────────────────────────────────────────────────────────────────

export const createTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;

  const { title, description, assignedTo, status, attachments } = req.body as {
    title: string;
    description: string;
    assignedTo: string[];
    status: string;
    attachments: { url?: string; mimeType?: string; size?: number }[];
  };

  if (!title?.trim()) throw new APIError(400, 'Task title is required');

  const newTask = await Task.create({
    project: projectId,
    title,
    description,
    assignedBy: req.user._id,
    assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
    status: status || TaskStatus.TODO,
    attachments: Array.isArray(attachments) ? attachments : [],
  });

  // Notify each assigned user so they know they have a new task
  if (newTask.assignedTo.length > 0) {
    const [project, assignees] = await Promise.all([
      Project.findById(projectId).lean(),
      User.find({ _id: { $in: newTask.assignedTo } })
        .select('userName email')
        .lean(),
    ]);

    await Promise.all(
      assignees.map((user) =>
        emailQueue.add('TaskAssigned', {
          to: user.email,
          subject: `You've been assigned to "${title}"`,
          mailgenContent: taskAssignedMailContent(user.userName, title, project?.name ?? ''),
        }),
      ),
    );
  }

  logger.info(`Task created: "${title}" in project ${projectId} by user ${req.user._id}`);
  return res.status(201).json(new APIResponse(201, { task: newTask }, 'Task created successfully'));
});

export const getTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;

  const allTasks = await Task.find({ project: projectId })
    .populate('assignedBy', 'userName fullName avatar email')
    .populate('assignedTo', 'userName fullName avatar email')
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json(new APIResponse(200, { tasks: allTasks }, 'Fetched all tasks'));
});

export const updateTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, taskId } = req.params;
  if (!taskId) throw new APIError(400, 'Task ID is required');

  // Task existence and permission already verified by validateTaskPermission middleware
  const task = await Task.findOne({ _id: taskId, project: projectId });
  if (!task) throw new APIError(404, 'Task not found');

  const { title, description, assignedTo, status, attachments } = req.body as {
    title: string;
    description: string;
    assignedTo: string[];
    status: string;
    attachments: { url?: string; mimeType?: string; size?: number }[];
  };

  const updatedFields: Record<string, any> = {};
  if (title?.trim()) updatedFields.title = title;
  if (status) updatedFields.status = status;
  if (description !== undefined) updatedFields.description = description;
  if (Array.isArray(assignedTo) && assignedTo.length > 0) updatedFields.assignedTo = assignedTo;
  if (Array.isArray(attachments) && attachments.length > 0) updatedFields.attachments = attachments;

  const updatedTask = await Task.findOneAndUpdate(
    { _id: taskId, project: projectId },
    { $set: updatedFields },
    { returnDocument: 'after' },
  )
    .populate('assignedTo', 'userName fullName avatar email')
    .populate('assignedBy', 'userName fullName avatar');

  // If status changed, notify all current assignees
  if (updatedFields.status && updatedTask) {
    const currentAssigneeIds = updatedFields.assignedTo ?? task.assignedTo.map(String);
    const assignees = await User.find({ _id: { $in: currentAssigneeIds } })
      .select('userName email')
      .lean();

    await Promise.all(
      assignees.map((user) =>
        emailQueue.add('TaskStatusUpdated', {
          to: user.email,
          subject: `Task "${updatedTask.title}" status changed to "${updatedFields.status}"`,
          mailgenContent: taskStatusUpdatedMailContent(
            user.userName,
            updatedTask.title,
            updatedFields.status,
          ),
        }),
      ),
    );
  }

  // If assignedTo changed, notify only newly added assignees
  if (Array.isArray(updatedFields.assignedTo)) {
    const oldIds = new Set(task.assignedTo.map(String));
    const newlyAddedIds = (updatedFields.assignedTo as string[]).filter((id) => !oldIds.has(id));

    if (newlyAddedIds.length > 0) {
      const [project, newAssignees] = await Promise.all([
        Project.findById(projectId).lean(),
        User.find({ _id: { $in: newlyAddedIds } })
          .select('userName email')
          .lean(),
      ]);

      await Promise.all(
        newAssignees.map((user) =>
          emailQueue.add('TaskAssigned', {
            to: user.email,
            subject: `You've been assigned to "${updatedTask?.title ?? task.title}"`,
            mailgenContent: taskAssignedMailContent(
              user.userName,
              updatedTask?.title ?? task.title,
              project?.name ?? '',
            ),
          }),
        ),
      );
    }
  }

  logger.info(`Task updated: ${taskId} in project ${projectId}`);
  return res
    .status(200)
    .json(new APIResponse(200, { task: updatedTask }, 'Task updated successfully'));
});

export const deleteTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, taskId } = req.params;
  if (!taskId) throw new APIError(400, 'Task ID is required');

  const task = await Task.findOne({ _id: taskId, project: projectId });
  if (!task) throw new APIError(404, 'Task not found');

  // req.user.role is the project-scoped role set by validateProjectPermission middleware
  const isAdmin = req.user.role === UserRoles.ADMIN;
  const isCreator = req.user._id.toString() === task.assignedBy.toString();

  // Only the task creator or a project admin can delete a task
  if (!isAdmin && !isCreator)
    throw new APIError(403, 'Only the task creator or a project admin can delete this task');

  await Task.deleteOne({ _id: taskId });
  await SubTask.deleteMany({ task: taskId });

  // Notify all assignees that the task they were working on has been removed
  if (task.assignedTo.length > 0) {
    const [project, assignees] = await Promise.all([
      Project.findById(projectId).lean(),
      User.find({ _id: { $in: task.assignedTo } })
        .select('userName email')
        .lean(),
    ]);

    await Promise.all(
      assignees.map((user) =>
        emailQueue.add('TaskDeleted', {
          to: user.email,
          subject: `Task "${task.title}" has been deleted`,
          mailgenContent: taskDeletedMailContent(user.userName, task.title, project?.name ?? ''),
        }),
      ),
    );
  }

  logger.info(`Task deleted: ${taskId} in project ${projectId} by user ${req.user._id}`);
  return res.status(200).json(new APIResponse(200, {}, 'Task deleted successfully'));
});

export const getAllSubTasks = asyncHandler(async (req, res, next) => {
  const { projectId, taskId } = req.params;
  if (!projectId || !taskId) throw new APIError(400, 'TaskId and ProjectId are required');

  const task = await Task.findOne({ _id: taskId, project: projectId });
  if (!task) throw new APIError(404, 'Task not found');

  const subtasks = await SubTask.find({ task: task._id }).lean();
  if (!subtasks.length) throw new APIError(404, 'No subtasks found');

  return res
    .status(200)
    .json(new APIResponse(200, { subtasks: subtasks }, 'Fetched all subtasks successfully.'));
});

