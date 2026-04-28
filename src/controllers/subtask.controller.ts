import type { Response } from 'express';

import { SubTask } from '../models/index';
import type { AuthenticatedRequest } from '../types/types';
import { asyncHandler, APIError, APIResponse, logger } from '../utils';
import { UserRoles } from '../utils/constants';

// ─── SubTask CRUD ─────────────────────────────────────────────────────────────

export const createSubTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const { title } = req.body as { title: string };

  if (!title?.trim()) throw new APIError(400, 'SubTask title is required');

  const subTask = await SubTask.create({
    title,
    task: taskId,
    isCompleted: false,
    createdBy: req.user._id,
  });

  logger.info(`SubTask created: "${title}" under task ${taskId} by user ${req.user._id}`);
  return res.status(201).json(new APIResponse(201, { subTask }, 'SubTask created successfully'));
});

export const getSubTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;

  const subTasks = await SubTask.find({ task: taskId })
    .populate('createdBy', 'userName fullName avatar')
    .sort({ createdAt: 1 })
    .lean();

  return res.status(200).json(new APIResponse(200, { subTasks }, 'Fetched all subtasks'));
});

export const updateSubTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { subtaskId } = req.params;
  const { title, isCompleted } = req.body as { title?: string; isCompleted?: boolean };

  const subTask = await SubTask.findById(subtaskId);
  if (!subTask) throw new APIError(404, 'SubTask not found');

  // validateTaskPermission already ensures user is task assigner, assignee, or admin
  const updatedFields: Record<string, any> = {};
  if (title?.trim()) updatedFields.title = title;
  if (isCompleted !== undefined) updatedFields.isCompleted = isCompleted;

  const updatedSubTask = await SubTask.findByIdAndUpdate(
    subtaskId,
    { $set: updatedFields },
    { returnDocument: 'after' },
  ).populate('createdBy', 'userName fullName avatar');

  logger.info(`SubTask updated: ${subtaskId} by user ${req.user._id}`);
  return res
    .status(200)
    .json(new APIResponse(200, { subTask: updatedSubTask }, 'SubTask updated successfully'));
});

export const deleteSubTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { subtaskId } = req.params;

  const subTask = await SubTask.findById(subtaskId);
  if (!subTask) throw new APIError(404, 'SubTask not found');

  // Only the creator or an admin can delete a subtask
  const isCreator = subTask.createdBy.toString() === req.user._id.toString();
  const isAdmin = req.user.role === UserRoles.ADMIN;
  if (!isCreator && !isAdmin)
    throw new APIError(403, 'Only the subtask creator or a project admin can delete this subtask');

  await SubTask.deleteOne({ _id: subtaskId });

  logger.info(`SubTask deleted: ${subtaskId} by user ${req.user._id}`);
  return res.status(200).json(new APIResponse(200, {}, 'SubTask deleted successfully'));
});
