import app from './src/app';
import connectToDB from './src/db/index';
import logger from './src/utils/logger';
import { emailWorker } from './src/jobs/emailQueue';

const PORT = Number(process.env.PORT) || 3000;

connectToDB()
  .then(() => {
    app.listen(PORT, 'localhost', () => logger.info(`Listening on localhost:${PORT}`));
  })
  .catch((error) => {
    logger.error(error);
  });

// Close the BullMQ worker cleanly so in-flight jobs finish before exit
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received — shutting down`);
  await emailWorker.close();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
