import type { Response } from 'express';

import { Project, ProjectMember, User } from '../models/index';
import type { AuthenticatedRequest, IUser } from '../types/types';
import {
  asyncHandler,
  APIError,
  APIResponse,
  logger,
  newProjectCreatedMailContent,
  projectDeletedMailContent,
  projectUpdatedMailContent,
  memberAddedToProjectMailContent,
  promotedToAdminMailContent,
} from '../utils';
import { AvailableUserRoles, UserRoles } from '../utils/constants';
import { emailQueue } from '../jobs/emailQueue';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getProjectsWithMemberships(userId: string) {
  const memberships = await ProjectMember.find({ user: userId }).populate('project').lean();
  if (memberships.length === 0) return [];

  return memberships.map((membership) => ({
    ...membership.project,
    myRole: membership.role,
  }));
}

async function getProjectAdmins(projectId: string) {
  const admins = await ProjectMember.find({ project: projectId, role: UserRoles.ADMIN })
    .populate('user', 'userName email')
    .lean();
  return admins.map((m) => m.user as unknown as IUser);
}

// ─── Project CRUD ─────────────────────────────────────────────────────────────

export const getProjects = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const projectWithMemberships = await getProjectsWithMemberships(req.user._id.toString());

  if (projectWithMemberships.length === 0) {
    return res.status(200).json(new APIResponse(200, { projects: [] }, 'No projects found'));
  }

  return res
    .status(200)
    .json(
      new APIResponse(
        200,
        { projects: projectWithMemberships },
        'All projects fetched successfully',
      ),
    );
});

export const getProjectByName = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  const project = await Project.findOne({ name: name, createdBy: [req.user._id] });

  if (!project) throw new APIError(404, 'Project does not exist');

  return res
    .status(200)
    .json(new APIResponse(200, { project: project }, 'Project fetched successfully'));
});

export const createProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, description } = req.body;

  // Check if a project already with this name exists
  const doesExist = await Project.findOne({ name: name, createdBy: [req.user._id] });
  if (doesExist) throw new APIError(409, 'Project with this name already exists');

  const createdProject = await Project.create({
    name,
    description,
    createdBy: [req.user._id],
  });

  // Auto-assign the creator as ADMIN so they can manage the project immediately
  await ProjectMember.create({
    user: req.user._id,
    project: createdProject._id,
    role: UserRoles.ADMIN,
  });

  await emailQueue.add('ProjectCreatedMail', {
    to: req.user.email,
    subject: `New project created: ${name}`,
    mailgenContent: newProjectCreatedMailContent(
      req.user.userName,
      name,
      `${req.protocol}://${req.get('host')}/api/v1/auth/forgot-password`,
    ),
  });

  logger.info(`Project created: "${name}" by user ${req.user._id}`);
  return res
    .status(201)
    .json(new APIResponse(201, { project: createdProject }, 'Project created successfully'));
});

export const updateProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { name, description } = req.body;

  if (!projectId) throw new APIError(400, 'Project ID is required');

  const updateFields: Record<string, string> = {};
  if (name) updateFields.name = name;
  if (description) updateFields.description = description;

  const updatedProject = await Project.findByIdAndUpdate(
    projectId,
    { $set: updateFields },
    { returnDocument: 'after' },
  );

  if (!updatedProject) throw new APIError(404, 'Project not found');

  // Notify all admins about what changed
  const admins = await getProjectAdmins(projectId);
  await Promise.all(
    admins.map((admin) =>
      emailQueue.add('ProjectUpdatedMail', {
        to: admin.email,
        subject: `Project "${updatedProject.name}" has been updated`,
        mailgenContent: projectUpdatedMailContent(admin.userName, updatedProject.name, updateFields),
      }),
    ),
  );

  logger.info(`Project updated: ${projectId} by user ${req.user._id}`);
  return res
    .status(200)
    .json(new APIResponse(200, { project: updatedProject }, 'Project updated successfully'));
});

export const deleteProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;

  const deletedProject = await Project.findByIdAndDelete(projectId);
  if (!deletedProject) throw new APIError(401, 'Project does not exist or you are not an admin');
  await ProjectMember.deleteMany({ project: projectId });

  await emailQueue.add('DeleteProjectMail', {
    to: req.user.email,
    subject: `${deletedProject.name} has been deleted`,
    mailgenContent: projectDeletedMailContent(
      req.user.userName,
      deletedProject.name,
      `${req.protocol}://${req.get('host')}/api/v1/auth/forgot-password`,
    ),
  });

  logger.info(`Project deleted: ${projectId} by user ${req.user._id}`);
  return res.status(200).json(new APIResponse(200, {}, 'Project deleted successfully'));
});

// ─── Member Management ────────────────────────────────────────────────────────

export const addProjectMembers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { members: membersToAdd } = req.body as { members: { userId: string; role: string }[] };

  if (!Array.isArray(membersToAdd) || membersToAdd.length === 0)
    throw new APIError(400, 'Please provide an array of members to add.');

  const invalidRole = membersToAdd.find((m) => !AvailableUserRoles.includes(m.role));
  if (invalidRole)
    throw new APIError(
      400,
      `Invalid role "${invalidRole.role}". Must be one of: ${AvailableUserRoles.join(', ')}`,
    );

  const userIds = membersToAdd.map((m) => m.userId);

  // Filter out users already in the project to avoid duplicate membership documents
  const existingIds = await ProjectMember.find({ project: projectId, user: { $in: userIds } })
    .distinct('user')
    .lean()
    .then((ids) => ids.map(String));

  const payload = membersToAdd
    .filter((m) => !existingIds.includes(m.userId))
    .map((m) => ({ project: projectId, user: m.userId, role: m.role }));

  if (payload.length > 0) {
    await ProjectMember.insertMany(payload);

    // Notify each newly added member of their role
    const [project, addedUsers] = await Promise.all([
      Project.findById(projectId).lean(),
      User.find({ _id: { $in: payload.map((m) => m.user) } }).select('userName email').lean(),
    ]);

    await Promise.all(
      addedUsers.map((user) => {
        const role = payload.find((m) => m.user === user._id.toString())?.role ?? UserRoles.MEMBER;
        return emailQueue.add('MemberAddedToProject', {
          to: user.email,
          subject: `You've been added to "${project?.name}"`,
          mailgenContent: memberAddedToProjectMailContent(user.userName, project?.name ?? '', role),
        });
      }),
    );

    logger.info(`Added ${payload.length} member(s) to project ${projectId}`);
    return res.status(201).json(new APIResponse(201, {}, 'All members added successfully'));
  }

  return res.status(200).json(new APIResponse(200, {}, 'All members were already in the project'));
});

export const deleteProjectMembers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.params;
    const { members: membersToDelete } = req.body as { members: string[] };

    if (!Array.isArray(membersToDelete) || membersToDelete.length === 0)
      throw new APIError(400, 'Please provide an array of members to delete.');

    // Prevent an admin from removing themselves — use deleteProject or transfer ownership instead
    if (membersToDelete.includes(req.user._id.toString()))
      throw new APIError(400, 'You cannot remove yourself from the project.');

    const result = await ProjectMember.deleteMany({
      project: projectId,
      user: { $in: membersToDelete },
    });

    logger.info(`Removed ${result.deletedCount} member(s) from project ${projectId}`);
    return res
      .status(200)
      .json(
        new APIResponse(200, { deletedCount: result.deletedCount }, 'Members removed successfully'),
      );
  },
);

export const getProjectMembers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;

  const members = await ProjectMember.find({ project: projectId })
    .populate('user', 'userName email fullName avatar role')
    .lean();

  const formattedMembers = members.map((member) => {
    const populatedUser = member.user as unknown as IUser;
    return {
      _id: populatedUser._id.toString(),
      userName: populatedUser.userName,
      email: populatedUser.email,
      fullName: populatedUser.fullName,
      avatar: populatedUser.avatar,
      globalRole: populatedUser.role,
      projectRole: member.role,
    };
  });

  return res
    .status(200)
    .json(new APIResponse(200, { members: formattedMembers }, 'Fetched all members successfully'));
});

export const updateMemberRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { id: membersToUpdate, role: newRole } = req.body as { id: string[]; role?: string };

  if (!Array.isArray(membersToUpdate) || membersToUpdate.length === 0)
    throw new APIError(400, 'Please provide an array of user IDs to update.');
  if (!newRole || !AvailableUserRoles.includes(newRole))
    throw new APIError(400, `Role must be one of: ${AvailableUserRoles.join(', ')}`);

  // Prevent an admin from accidentally demoting themselves
  const safeMembersToUpdate = membersToUpdate.filter((id) => id !== req.user._id.toString());
  if (safeMembersToUpdate.length === 0) throw new APIError(400, 'You cannot update your own role.');

  const result = await ProjectMember.updateMany(
    { project: projectId, user: { $in: safeMembersToUpdate } },
    { $set: { role: newRole } },
  );

  // Notify users promoted to ADMIN so they know they have new permissions
  if (newRole === UserRoles.ADMIN) {
    const [project, promotedUsers] = await Promise.all([
      Project.findById(projectId).lean(),
      User.find({ _id: { $in: safeMembersToUpdate } }).select('userName email').lean(),
    ]);

    await Promise.all(
      promotedUsers.map((user) =>
        emailQueue.add('PromotedToAdmin', {
          to: user.email,
          subject: `You've been promoted to Admin in "${project?.name}"`,
          mailgenContent: promotedToAdminMailContent(user.userName, project?.name ?? ''),
        }),
      ),
    );
  }

  logger.info(
    `Updated role to "${newRole}" for ${result.modifiedCount} member(s) in project ${projectId}`,
  );
  return res
    .status(200)
    .json(
      new APIResponse(
        200,
        { updatedCount: result.modifiedCount },
        'Member roles updated successfully',
      ),
    );
});
