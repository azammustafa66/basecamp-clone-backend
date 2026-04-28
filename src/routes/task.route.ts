import { Router } from 'express';

import {
  validateProjectPermission,
  validateTaskPermission,
  verifyJWT,
} from '../middlewares/auth.middleware';
import { createTask, getTasks, updateTask, deleteTask } from '../controllers/task.controller';
import {
  createSubTask,
  getSubTasks,
  updateSubTask,
  deleteSubTask,
} from '../controllers/subtask.controller';

const router = Router();

// ─── Task Routes ──────────────────────────────────────────────────────────────

// verifyJWT confirms the user is logged in
// validateProjectPermission() confirms they are a member of the project and sets req.user.role
router.use(verifyJWT, validateProjectPermission());

/**
 * @swagger
 * /project/{projectId}/task:
 *   get:
 *     tags: [Tasks]
 *     summary: Get all tasks in a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of tasks sorted by newest first
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task
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
 *             required: [title]
 *             properties:
 *               title: { type: string, example: Design homepage }
 *               description: { type: string }
 *               assignedTo:
 *                 type: array
 *                 items: { type: string }
 *               status: { type: string, enum: [todo, in_progress, done] }
 *     responses:
 *       201:
 *         description: Task created — assignees notified by email
 */
router.route('/:projectId/task').get(getTasks).post(createTask);

/**
 * @swagger
 * /project/{projectId}/{taskId}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update a task (assigner, assignee, or admin)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [todo, in_progress, done] }
 *               assignedTo:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Task updated — assignees notified if status or assignments changed
 *       403:
 *         description: Must be assigner, assignee, or admin
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task and all its subtasks (creator or admin)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Task deleted — assignees notified by email
 *       403:
 *         description: Must be task creator or admin
 */
router.route('/:projectId/:taskId').patch(validateTaskPermission, updateTask).delete(deleteTask);

/**
 * @swagger
 * /project/{projectId}/{taskId}/subtask:
 *   get:
 *     tags: [Subtasks]
 *     summary: Get all subtasks for a task
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of subtasks sorted oldest first
 *   post:
 *     tags: [Subtasks]
 *     summary: Create a subtask (task assigner, assignee, or admin)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, example: Write copy for hero section }
 *     responses:
 *       201:
 *         description: Subtask created
 */
router
  .route('/:projectId/:taskId/subtask')
  .get(validateTaskPermission, getSubTasks)
  .post(validateTaskPermission, createSubTask);

/**
 * @swagger
 * /project/{projectId}/{taskId}/subtask/{subtaskId}:
 *   patch:
 *     tags: [Subtasks]
 *     summary: Update a subtask title or completion (task assigner, assignee, or admin)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               isCompleted: { type: boolean }
 *     responses:
 *       200:
 *         description: Subtask updated
 *   delete:
 *     tags: [Subtasks]
 *     summary: Delete a subtask (subtask creator or admin)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Subtask deleted
 *       403:
 *         description: Must be subtask creator or admin
 */
router
  .route('/:projectId/:taskId/subtask/:subtaskId')
  .patch(validateTaskPermission, updateSubTask)
  .delete(validateTaskPermission, deleteSubTask);

export default router;
