import winston from 'winston';

// ─── Config ───────────────────────────────────────────────────────────────────

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// ─── Format ───────────────────────────────────────────────────────────────────

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
);

// ─── Transports ───────────────────────────────────────────────────────────────

// 1. Always start with the Console transport (Render relies on this)
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize({ all: true })),
  }),
];

// 2. Only add File transports if we are running locally (NOT in production)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/info.log',
      level: 'info',
    }),
    new winston.transports.File({
      filename: 'logs/all.log',
    })
  );
}

// ─── Logger ───────────────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;