import { Router } from 'express';

import { validateProjectPermission, verifyJWT } from '../middlewares/auth.middleware';
import {
  addProjectMembers,
  createProject,
  deleteProject,
  deleteProjectMembers,
  getProjectMembers,
  getProjects,
  updateMemberRole,
  updateProject,
} from '../controllers/project.controller';
import { UserRoles } from '../utils/constants';

const router = Router();

router.use(verifyJWT);

// ─── Collection Routes ( /api/v1/projects ) ───────────────────────────────────

/**
 * @swagger
 * /project:
 *   get:
 *     tags: [Projects]
 *     summary: List all projects the current user belongs to
 *     responses:
 *       200:
 *         description: List of projects with the user's role in each
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Website Redesign }
 *               description: { type: string, example: Redesign the company website }
 *     responses:
 *       201:
 *         description: Project created — creator auto-assigned as admin
 *       409:
 *         description: Project with this name already exists
 */
router.route('/').get(getProjects).post(createProject);

// ─── Project Routes ( /api/v1/projects/:projectId ) ───────────────────────────

/**
 * @swagger
 * /project/{projectId}:
 *   patch:
 *     tags: [Projects]
 *     summary: Update project name or description (admin only)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Project updated — all admins notified by email
 *       403:
 *         description: Admin role required
 *   delete:
 *     tags: [Projects]
 *     summary: Delete a project and all its members (admin only)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Project deleted
 *       403:
 *         description: Admin role required
 */
router
  .route('/:projectId')
  .patch(validateProjectPermission([UserRoles.ADMIN]), updateProject)
  .delete(validateProjectPermission([UserRoles.ADMIN]), deleteProject);

// ─── Member Routes ( /api/v1/projects/:projectId/members ) ────────────────────

/**
 * @swagger
 * /project/{projectId}/members:
 *   get:
 *     tags: [Projects]
 *     summary: List all members of a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of members with their project role
 *   post:
 *     tags: [Projects]
 *     summary: Add members to a project (admin only)
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
 *             required: [members]
 *             properties:
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [userId, role]
 *                   properties:
 *                     userId: { type: string }
 *                     role: { type: string, enum: [admin, member] }
 *     responses:
 *       201:
 *         description: Members added — each notified by email
 *       200:
 *         description: All provided users were already members
 */
router
  .route('/:projectId/members')
  .get(validateProjectPermission(), getProjectMembers)
  .post(validateProjectPermission([UserRoles.ADMIN]), addProjectMembers);

/**
 * @swagger
 * /project/{projectId}/members/{userId}:
 *   patch:
 *     tags: [Projects]
 *     summary: Update a member's role (admin only)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, role]
 *             properties:
 *               id:
 *                 type: array
 *                 items: { type: string }
 *               role: { type: string, enum: [admin, member] }
 *     responses:
 *       200:
 *         description: Role updated — promoted users notified by email if role is admin
 *   delete:
 *     tags: [Projects]
 *     summary: Remove members from a project (admin only)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [members]
 *             properties:
 *               members:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Members removed
 */
router
  .route('/:projectId/members/:userId')
  .patch(validateProjectPermission([UserRoles.ADMIN]), updateMemberRole)
  .delete(validateProjectPermission([UserRoles.ADMIN]), deleteProjectMembers);

export default router;
