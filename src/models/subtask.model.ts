import { model, Schema, Types } from 'mongoose';
import { type ISubTask } from '../types/types';

const SubTaskSchema = new Schema<ISubTask>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    task: {
      type: Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    isCompleted: {
      type: Boolean,
      required: true,
      default: false,
    },
    createdBy: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

export const SubTask = model('SubTask', SubTaskSchema);
