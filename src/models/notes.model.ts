import { model, Schema, Types } from 'mongoose';

import type { INotes } from '../types/types';

const ProjectNoteSchema = new Schema<INotes>(
  {
    project: {
      type: Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    createdBy: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export const ProjectNote = model('Notes', ProjectNoteSchema);
