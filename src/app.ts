import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import { mainRouter } from './routes/index';
import { APIResponse, type APIError } from './utils/index';
import logger from './utils/logger';
import { swaggerSpec } from './config/swagger';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  express.json({ limit: '16kb' }),
  express.urlencoded({ extended: true, limit: '16kb' }),
  express.static('public'),
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
  cookieParser(),
);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use(mainRouter);

// ─── API Docs ─────────────────────────────────────────────────────────────────

app.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.status(200).json(new APIResponse(200, { message: 'Server up and running' }));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err: APIError, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message || 'Unknown Error');

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    statusCode: statusCode,
    message: err.message || 'Internal Server Error',
    errors: err.errors || [],
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

export default app;
