import jwt from 'jsonwebtoken';

import { ProjectMember, Task, User } from '../models';
import { asyncHandler, APIError, logger } from '../utils';
import type { AuthenticatedRequest, DecodedToken } from '../types/types';
import { UserRoles } from '../utils/constants';

export const verifyJWT = asyncHandler(async (req: AuthenticatedRequest, _res, next) => {
  try {
    // Accept token from cookie (browser) or Authorization header (API clients / mobile)
    const token = req.cookies.accessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Unauthorized request — no token provided');
      throw new APIError(401, 'Unauthorized Request');
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as DecodedToken;
    // Exclude sensitive fields so they're never accidentally exposed via req.user
    const user = await User.findById(decoded._id).select(
      '-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry',
    );
    if (!user) {
      logger.warn(`Invalid access token — no user found for id: ${decoded._id}`);
      throw new APIError(401, 'Invalid Access Token');
    }
    req.user = user;

    next();
  } catch (error: any) {
    logger.error(`JWT verification failed: ${error.message}`);

    if (error.name === 'TokenExpiredError') {
      return next(new APIError(401, 'Access token has expired'));
    }

    if (error.name === 'JsonWebTokenError') {
      return next(new APIError(401, 'Invalid access token'));
    }

    next(new APIError(500, 'Something went wrong while verifying the token'));
  }
});

export const validateProjectPermission = (roles: string[] = []) =>
  asyncHandler(async (req: AuthenticatedRequest, _res, next) => {
    const { projectId } = req.params;
    if (!projectId) throw new APIError(400, 'Project ID is required');

    const membership = await ProjectMember.findOne({ project: projectId, user: req.user._id });
    if (!membership) throw new APIError(404, 'Project not found or you are not part of it');

    // Attach the project-scoped role to req.user so controllers can read it without re-querying
    req.user.role = String(membership.role);

    // Only enforce role restriction when specific roles are required
    if (roles.length > 0 && !roles.includes(req.user.role))
      throw new APIError(403, 'You do not have permission to perform this action');

    next();
  });

export const validateTaskPermission = asyncHandler(async (req: AuthenticatedRequest, _res, next) => {
  const { taskId } = req.params;
  if (!taskId) throw new APIError(400, 'Task ID is required');

  // Admins (role set by validateProjectPermission) can bypass task-level checks
  if (req.user.role === 'admin') return next();

  const task = await Task.findById(taskId);
  if (!task) throw new APIError(404, 'Task not found');

  const userId = req.user._id.toString();
  const isAssigner = task.assignedBy.toString() === userId;
  const isAssignee = task.assignedTo.map(String).includes(userId);
  const isAdmin = req.user.role === UserRoles.ADMIN

  if ((!isAssigner && !isAssignee) || !isAdmin)
    throw new APIError(403, 'You are not authorised for this operation');

  next();
});
