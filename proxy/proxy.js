/**
 * MiniTel-Lite Proxy Server
 * Acts as a bridge between the frontend and the MiniTel-Lite server
 */

const net = require('net');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { loadConfig, logger } = require('./config');
const { encodeFrame } = require('./protocol/encoder');
const { decodeFrame } = require('./protocol/decoder');
const NonceManager = require('./protocol/nonce');
const SessionRecorder = require('./recorder/recorder');
const { COMMANDS, RESPONSES, COMMAND_NAMES } = require('./protocol/constants');

// Initialize config
let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`Configuration error: ${error.message}`);
  console.error('Ensure you have a valid .env file. You can copy .env.example to .env as a starting point.');
  process.exit(1);
}

// Create recorder and nonce manager
const recorder = new SessionRecorder();
const nonceManager = new NonceManager();

// Create Express app and WebSocket server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// TCP socket and state
let socket = null;
let isConnected = false;
let dumpCount = 0;
let overrideCode = null;

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Handle WebSocket connections
wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');

  // Send initial state to client
  sendStatus(ws);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      logger.info(`Received command: ${data.command}`);

      switch (data.command) {
        case 'hack':
          await executeHack(ws);
          break;
        case 'toggleRecording':
          toggleRecording(ws, data.enable);
          break;
        default:
          logger.warn(`Unknown command: ${data.command}`);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Unknown command: ${data.command}` 
          }));
      }
    } catch (error) {
      logger.error(`Error processing message: ${error.message}`);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Error: ${error.message}` 
      }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });
});

/**
 * Send current status to WebSocket client
 * @param {WebSocket} ws - WebSocket client
 */
function sendStatus(ws) {
  ws.send(JSON.stringify({
    type: 'status',
    connected: isConnected,
    recording: recorder.isRecording(),
    overrideCode
  }));
}

/**
 * Toggle session recording
 * @param {WebSocket} ws - WebSocket client
 * @param {boolean} enable - Whether to enable or disable recording
 */
function toggleRecording(ws, enable) {
  if (enable) {
    // Start a new recording session (will stop any existing recording)
    recorder.startRecording();
    ws.send(JSON.stringify({
      type: 'update',
      message: 'Started new recording session'
    }));
  } else {
    // Stop current recording
    if (recorder.stopRecording()) {
      ws.send(JSON.stringify({
        type: 'update',
        message: 'Recording stopped and saved'
      }));
    }
  }
  sendStatus(ws);
}

/**
 * Execute the HACK sequence (HELLO -> DUMP -> DUMP)
 * @param {WebSocket} ws - WebSocket client
 */
async function executeHack(ws) {
  // Reset state
  overrideCode = null;
  dumpCount = 0;
  
  // Send status update
  ws.send(JSON.stringify({
    type: 'status',
    connected: false,
    recording: recorder.isRecording(),
    overrideCode: null,
    message: 'Starting hack sequence...'
  }));

  try {
    // Connect to server
    try {
      await connectToServer(ws);
    } catch (connectionError) {
      // For initial connection errors, don't retry - just report and stop
      logger.error(`Initial connection failed: ${connectionError.message}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Connection failed: ${connectionError.message}. Please try again later.`
      }));
      
      // Reset state and return early
      overrideCode = null;
      dumpCount = 0;
      isConnected = false;
      return;
    }
    
    // Send HELLO
    ws.send(JSON.stringify({
      type: 'update',
      message: 'Sending HELLO command...'
    }));
    
    try {
      const helloResponse = await sendCommand(ws, COMMANDS.HELLO);
      
      if (helloResponse.cmd !== RESPONSES.HELLO_ACK) {
        throw new Error(`Expected HELLO_ACK, got ${helloResponse.cmdName}`);
      }
      
      ws.send(JSON.stringify({
        type: 'update',
        message: 'Authentication successful. Sending first DUMP command...'
      }));
      
      // Send first DUMP
      const firstDumpResponse = await sendCommand(ws, COMMANDS.DUMP);
      
      if (firstDumpResponse.cmd !== RESPONSES.DUMP_FAILED) {
        throw new Error(`Expected DUMP_FAILED, got ${firstDumpResponse.cmdName}`);
      }
      
      ws.send(JSON.stringify({
        type: 'update',
        message: 'First DUMP failed as expected. Sending second DUMP command...'
      }));
      
      // Only for the second DUMP we want to retry if there's a connection issue
      // as this is mid-sequence and part of the expected flow
      const secondDumpResponse = await sendCommand(ws, COMMANDS.DUMP);
      
      if (secondDumpResponse.cmd !== RESPONSES.DUMP_OK) {
        throw new Error(`Expected DUMP_OK, got ${secondDumpResponse.cmdName}`);
      }
      
      // Extract override code from payload
      overrideCode = secondDumpResponse.payload.trim();
      
      ws.send(JSON.stringify({
        type: 'success',
        message: 'Override code retrieved successfully!',
        overrideCode
      }));
      
      // Send STOP command to gracefully close connection
      await sendCommand(ws, COMMANDS.STOP_CMD);
    } catch (commandError) {
      // For command errors, reset to idle state
      logger.error(`Command sequence failed: ${commandError.message}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Hack failed: ${commandError.message}`
      }));
    } finally {
      // Always close connection and update client regardless of outcome
      closeConnection();
      sendStatus(ws);
    }
  } catch (error) {
    // Catch any unexpected errors in the overall hack sequence
    logger.error(`Hack sequence failed with unexpected error: ${error.message}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Unexpected error: ${error.message}`
    }));
    
    // Ensure connection is closed and state is reset
    closeConnection();
    sendStatus(ws);
  }
}

/**
 * Connect to the MiniTel-Lite server
 * @param {WebSocket} ws - WebSocket client
 * @returns {Promise} - Resolves when connected
 */
function connectToServer(ws) {
  return new Promise((resolve, reject) => {
    // Close existing connection if any
    closeConnection();
    
    // Reset nonce manager
    nonceManager.reset();
    
    ws.send(JSON.stringify({
      type: 'update',
      message: `Connecting to ${config.server.host}:${config.server.port}...`
    }));
    
    socket = new net.Socket();
    
    // Set timeouts
    socket.setTimeout(config.timeouts.idle);
    
    // Handle socket events
    socket.on('connect', () => {
      isConnected = true;
      logger.info(`Connected to ${config.server.host}:${config.server.port}`);
      resolve();
    });
    
    socket.on('data', (data) => {
      handleServerData(data);
    });
    
    socket.on('error', (error) => {
      logger.error(`Socket error: ${error.message}`);
      isConnected = false;
      reject(error);
    });
    
    socket.on('timeout', () => {
      logger.warn('Socket timeout');
      isConnected = false;
      socket.destroy();
      reject(new Error('Connection timed out'));
    });
    
    socket.on('close', () => {
      logger.info('Connection closed');
      isConnected = false;
    });
    
    // Connect to server
    socket.connect(config.server.port, config.server.host);
  });
}

/**
 * Close the TCP connection
 */
function closeConnection() {
  if (socket && !socket.destroyed) {
    socket.destroy();
  }
  isConnected = false;
}

/**
 * Handle data received from the server
 * @param {Buffer} data - Raw data received from server
 */
let responseResolve = null;
let responseReject = null;
let responseTimer = null;

function handleServerData(data) {
  try {
    // Decode the frame
    const decodedFrame = decodeFrame(data);
    
    // Record response if recording
    if (recorder.isRecording()) {
      recorder.recordResponse(data, decodedFrame);
    }
    
    if (!decodedFrame.valid) {
      logger.error(`Invalid frame received: ${decodedFrame.error}`);
      if (responseReject) {
        responseReject(new Error(`Invalid frame: ${decodedFrame.error}`));
        clearResponseHandlers();
      }
      return;
    }
    
    logger.info(`Received ${decodedFrame.cmdName} (nonce=${decodedFrame.nonce})`);
    
    // Validate nonce
    if (!nonceManager.validateServerNonce(decodedFrame.nonce)) {
      logger.error(`Nonce mismatch: expected=${nonceManager.getExpectedServerNonce()}, got=${decodedFrame.nonce}`);
      if (responseReject) {
        responseReject(new Error('Nonce mismatch'));
        clearResponseHandlers();
      }
      return;
    }
    
    // Update server nonce
    nonceManager.updateServerNonce(decodedFrame.nonce);
    
    // Handle different response types
    if (decodedFrame.cmd === RESPONSES.DUMP_OK) {
      // Received override code
      overrideCode = decodedFrame.payload.trim();
      logger.info('Received override code');
    }
    
    // Resolve the pending promise
    if (responseResolve) {
      responseResolve(decodedFrame);
      clearResponseHandlers();
    }
  } catch (error) {
    logger.error(`Error handling server data: ${error.message}`);
    if (responseReject) {
      responseReject(error);
      clearResponseHandlers();
    }
  }
}

/**
 * Clear response handlers and timers
 */
function clearResponseHandlers() {
  responseResolve = null;
  responseReject = null;
  if (responseTimer) {
    clearTimeout(responseTimer);
    responseTimer = null;
  }
}

/**
 * Send a command to the server and wait for response
 * @param {WebSocket} ws - WebSocket client
 * @param {number} cmd - Command code
 * @param {string} payload - Optional payload
 * @returns {Promise<Object>} - Decoded response frame
 */
function sendCommand(ws, cmd, payload = '') {
  return new Promise((resolve, reject) => {
    if (!isConnected) {
      return reject(new Error('Not connected to server'));
    }
    
    // Clear any existing handlers
    clearResponseHandlers();
    
    // Set up new promise handlers
    responseResolve = resolve;
    responseReject = reject;
    
    // Get the next client nonce
    const nonce = nonceManager.getNextClientNonce();
    
    // Encode the frame
    const frame = encodeFrame(cmd, nonce, payload);
    
    // Update client nonce
    nonceManager.updateClientNonce(nonce);
    
    // Record request if recording
    if (recorder.isRecording()) {
      const decodedRequest = {
        cmd,
        cmdName: COMMAND_NAMES[cmd] || 'UNKNOWN',
        nonce,
        payload,
        valid: true
      };
      recorder.recordRequest(frame, decodedRequest);
    }
    
    // Set response timeout
    responseTimer = setTimeout(() => {
      responseReject(new Error('Response timeout'));
      clearResponseHandlers();
    }, config.timeouts.response);
    
    // Send the frame
    logger.info(`Sending ${COMMAND_NAMES[cmd]} (nonce=${nonce})`);
    socket.write(frame);
    
    // Update UI
    ws.send(JSON.stringify({
      type: 'update',
      message: `Sent ${COMMAND_NAMES[cmd]} command`
    }));
  });
}

// Start the server
server.listen(config.proxy.port, () => {
  logger.info(`MiniTel-Lite proxy server listening on port ${config.proxy.port}`);
  logger.info(`Server target: ${config.server.host}:${config.server.port}`);
  logger.info('Open http://localhost:' + config.proxy.port + ' in your browser');
});