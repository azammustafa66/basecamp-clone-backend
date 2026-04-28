import { type ConnectionOptions, Queue, Worker } from 'bullmq';
import { logger, sendEmail } from '../utils/index';
import type { SendEmailOptions } from '../types/types';

const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6000,
};

export const emailQueue = new Queue('EmailQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  },
});

export const emailWorker = new Worker(
  'EmailQueue',
  async (job) => {
    logger.info(`[Job ${job.id}] Picking up email task`);
    const { to, subject, mailgenContent } = job.data as SendEmailOptions;

    await sendEmail({ to: to, subject: subject, mailgenContent: mailgenContent });
  },
  { connection: redisConnection },
);

emailWorker.on('completed', (job) => {
  logger.info(`[Job ${job.id}] Email sent successfully`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`[Job ${job?.id}] Failed after all retries: ${err.message}`);
});

// Connection/transport errors — not tied to a specific job
emailWorker.on('error', (err) => {
  logger.error(`Email worker error: ${err.message}`);
});
