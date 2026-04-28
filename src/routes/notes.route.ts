import { Router } from 'express';

import { verifyJWT, validateProjectPermission } from '../middlewares/auth.middleware';
import { createNote, getNotes, updateNote, deleteNote } from '../controllers/notes.controller';

const router = Router();

// ─── Notes Routes ─────────────────────────────────────────────────────────────

// All notes routes require membership — controller handles author/admin check for write ops
router.use(verifyJWT, validateProjectPermission());

/**
 * @swagger
 * /project/{projectId}/notes:
 *   get:
 *     tags: [Notes]
 *     summary: Get all notes for a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of notes sorted newest first
 *   post:
 *     tags: [Notes]
 *     summary: Create a note in a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, example: Meeting notes from Monday standup }
 *     responses:
 *       201:
 *         description: Note created
 */
router.route('/:projectId/notes').get(getNotes).post(createNote);

/**
 * @swagger
 * /project/{projectId}/notes/{noteId}:
 *   patch:
 *     tags: [Notes]
 *     summary: Update a note (author or admin)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *     responses:
 *       200:
 *         description: Note updated
 *       403:
 *         description: Must be note author or admin
 *   delete:
 *     tags: [Notes]
 *     summary: Delete a note (author or admin)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Note deleted
 *       403:
 *         description: Must be note author or admin
 */
router.route('/:projectId/notes/:noteId').patch(updateNote).delete(deleteNote);

export default router;
