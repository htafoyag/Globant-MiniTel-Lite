/**
 * MiniTel-Lite Configuration
 * Loads environment variables and provides configuration values
 */

require('dotenv').config();
const winston = require('winston');

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Load and validate configuration
function loadConfig() {
  const config = {
    server: {
      host: process.env.SERVER_HOST,
      port: parseInt(process.env.SERVER_PORT, 10)
    },
    timeouts: {
      idle: parseInt(process.env.IDLE_TIMEOUT_MS, 10),
      response: parseInt(process.env.RESPONSE_TIMEOUT_MS, 10)
    },
    proxy: {
      port: parseInt(process.env.PROXY_PORT, 10)
    },
    recordings: {
      dir: process.env.RECORDINGS_DIR
    },
    logging: {
      level: process.env.LOG_LEVEL
    }
  };

  // Validate configuration
  const missingVars = [];

  if (!config.server.host) missingVars.push('SERVER_HOST');
  if (isNaN(config.server.port)) missingVars.push('SERVER_PORT');
  if (isNaN(config.timeouts.idle)) missingVars.push('IDLE_TIMEOUT_MS');
  if (isNaN(config.timeouts.response)) missingVars.push('RESPONSE_TIMEOUT_MS');
  if (isNaN(config.proxy.port)) missingVars.push('PROXY_PORT');
  if (!config.recordings.dir) missingVars.push('RECORDINGS_DIR');

  if (missingVars.length > 0) {
    const errorMsg = `Missing environment variables: ${missingVars.join(', ')}. Please check your .env file.`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  return config;
}

module.exports = {
  loadConfig,
  logger
};