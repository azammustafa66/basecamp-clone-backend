import { Router } from 'express';

import healthCheckRouter from './healthCheck.route';
import authRouter from './auth.route';
import projectRouter from './project.route';
import taskRouter from './task.route';
import notesRouter from './notes.route';

const api = Router();

api.use('/health-check', healthCheckRouter);
api.use('/auth', authRouter);
api.use('/project', projectRouter);
api.use('/project', taskRouter);
api.use('/project', notesRouter);

export const mainRouter = Router().use('/api/v1', api);
