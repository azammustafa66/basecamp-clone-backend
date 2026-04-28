import { model, Schema } from 'mongoose';

import { UserRoles, AvailableUserRoles } from '../utils/constants';
import { type IProjectMember } from '../types/types';

const ProjectMemeberSchema = new Schema<IProjectMember>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    role: {
      type: String,
      enum: AvailableUserRoles,
      default: UserRoles.MEMBER,
    },
  },
  { timestamps: true },
);

export const ProjectMember = model('ProjectMember', ProjectMemeberSchema);
