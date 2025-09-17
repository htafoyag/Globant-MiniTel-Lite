/**
 * MiniTel-Lite Protocol Constants
 * Contains all protocol-specific constants and command codes
 */

// Load environment variables
require('dotenv').config();

// Command codes (client -> server)
const COMMANDS = {
  HELLO: 0x01,
  DUMP: 0x02,
  STOP_CMD: 0x04
};

// Response codes (server -> client)
const RESPONSES = {
  HELLO_ACK: 0x81,
  DUMP_FAILED: 0x82,
  DUMP_OK: 0x83,
  STOP_OK: 0x84
};

// Command names for logging and debugging
const COMMAND_NAMES = {
  [COMMANDS.HELLO]: 'HELLO',
  [COMMANDS.DUMP]: 'DUMP',
  [COMMANDS.STOP_CMD]: 'STOP_CMD',
  [RESPONSES.HELLO_ACK]: 'HELLO_ACK',
  [RESPONSES.DUMP_FAILED]: 'DUMP_FAILED',
  [RESPONSES.DUMP_OK]: 'DUMP_OK',
  [RESPONSES.STOP_OK]: 'STOP_OK'
};

// Server connection settings
const SERVER = {
  HOST: process.env.SERVER_HOST,
  PORT: parseInt(process.env.SERVER_PORT, 10)
};

// Timeout settings (in milliseconds)
const TIMEOUTS = {
  IDLE: parseInt(process.env.IDLE_TIMEOUT_MS || '2000', 10),
  RESPONSE: parseInt(process.env.RESPONSE_TIMEOUT_MS || '2000', 10)
};

// Proxy server settings
const PROXY = {
  PORT: parseInt(process.env.PROXY_PORT || '8080', 10)
};

// Recording settings
const RECORDING = {
  DIR: process.env.RECORDINGS_DIR || './recordings'
};

module.exports = {
  COMMANDS,
  RESPONSES,
  COMMAND_NAMES,
  SERVER,
  TIMEOUTS,
  PROXY,
  RECORDING
};