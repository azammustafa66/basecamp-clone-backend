import { model, Schema, Types } from 'mongoose';

import { TaskStatus, AvailableTaskStatus } from '../utils/constants';
import type { ITask } from '../types/types';

const TaskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    assignedBy: {
      type: Types.ObjectId,
      ref: 'User',
    },
    assignedTo: {
      type: [{ type: Types.ObjectId, ref: 'User' }],
      default: [],
    },
    project: {
      type: Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    status: {
      type: String,
      enum: AvailableTaskStatus,
      default: TaskStatus.TODO,
    },
    attachments: {
      type: [
        {
          url: String,
          mimeType: String,
          size: Number,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const Task = model('Task', TaskSchema);
