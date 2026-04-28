import mongoose from 'mongoose';

import logger from '../utils/logger';

const MONGO_URI = process.env.MONGO_URI as string;

async function connectToDB() {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to DB');
  } catch (error) {
    logger.error(`Something went wrong ${error}`);
    process.exit(1);
  }
}

export default connectToDB;
