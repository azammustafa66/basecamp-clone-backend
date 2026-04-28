import { model, Schema, Types } from 'mongoose';
import { type IProject } from '../types/types';

const ProjectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: [{ type: Types.ObjectId, ref: 'User' }],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Project = model('Project', ProjectSchema);
