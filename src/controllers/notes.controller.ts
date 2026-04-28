import type { Response } from 'express';

import { ProjectNote } from '../models/index';
import type { AuthenticatedRequest } from '../types/types';
import { asyncHandler, APIError, APIResponse, logger } from '../utils';
import { UserRoles } from '../utils/constants';

// ─── Notes CRUD ───────────────────────────────────────────────────────────────

export const createNote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { content } = req.body as { content: string };

  if (!content?.trim()) throw new APIError(400, 'Note content is required');

  const note = await ProjectNote.create({
    project: projectId,
    createdBy: req.user._id,
    content,
  });

  logger.info(`Note created in project ${projectId} by user ${req.user._id}`);
  return res.status(201).json(new APIResponse(201, { note }, 'Note created successfully'));
});

export const getNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;

  const notes = await ProjectNote.find({ project: projectId })
    .populate('createdBy', 'userName fullName avatar')
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json(new APIResponse(200, { notes }, 'Fetched all notes'));
});

export const updateNote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { noteId } = req.params;
  const { content } = req.body as { content: string };

  if (!content?.trim()) throw new APIError(400, 'Note content is required');

  const note = await ProjectNote.findById(noteId);
  if (!note) throw new APIError(404, 'Note not found');

  // Only the author or an admin can edit a note
  const isAuthor = note.createdBy.toString() === req.user._id.toString();
  const isAdmin = req.user.role === UserRoles.ADMIN;
  if (!isAuthor && !isAdmin)
    throw new APIError(403, 'Only the note author or a project admin can edit this note');

  const updatedNote = await ProjectNote.findByIdAndUpdate(
    noteId,
    { $set: { content } },
    { returnDocument: 'after' },
  ).populate('createdBy', 'userName fullName avatar');

  logger.info(`Note updated: ${noteId} by user ${req.user._id}`);
  return res
    .status(200)
    .json(new APIResponse(200, { note: updatedNote }, 'Note updated successfully'));
});

export const deleteNote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { noteId } = req.params;

  const note = await ProjectNote.findById(noteId);
  if (!note) throw new APIError(404, 'Note not found');

  // Only the author or an admin can delete a note
  const isAuthor = note.createdBy.toString() === req.user._id.toString();
  const isAdmin = req.user.role === UserRoles.ADMIN;
  if (!isAuthor && !isAdmin)
    throw new APIError(403, 'Only the note author or a project admin can delete this note');

  await ProjectNote.deleteOne({ _id: noteId });

  logger.info(`Note deleted: ${noteId} by user ${req.user._id}`);
  return res.status(200).json(new APIResponse(200, {}, 'Note deleted successfully'));
});
