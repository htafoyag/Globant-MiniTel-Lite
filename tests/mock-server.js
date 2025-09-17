/**
 * MiniTel-Lite Mock Server
 * Used for integration testing without connecting to the real server
 */

const net = require('net');
const { encodeFrame } = require('../proxy/protocol/encoder');
const { decodeFrame } = require('../proxy/protocol/decoder');
const { COMMANDS, RESPONSES } = require('../proxy/protocol/constants');

// Server state
let dumpCount = 0;
let connectionNonce = 0;
let lastCommand = null;

// Create TCP server
const server = net.createServer((socket) => {
  console.log('Client connected');
  
  // Reset state for new connection
  dumpCount = 0;
  connectionNonce = 0;
  lastCommand = null;
  
  // Set idle timeout
  socket.setTimeout(2000);
  
  socket.on('data', (data) => {
    try {
      // Decode the frame
      const frame = decodeFrame(data);
      
      if (!frame.valid) {
        console.log(`[ERROR] Invalid frame: ${frame.error}`);
        socket.destroy();
        return;
      }
      
      console.log(`[RECV] ${frame.cmdName} (nonce=${frame.nonce})`);
      
      // Validate nonce
      if (frame.cmd !== COMMANDS.HELLO && frame.nonce !== connectionNonce) {
        console.log(`[ERROR] Nonce mismatch: expected=${connectionNonce}, got=${frame.nonce}`);
        socket.destroy();
        return;
      }
      
      // Handle commands
      switch (frame.cmd) {
        case COMMANDS.HELLO:
          // Reset dump count and set nonce
          dumpCount = 0;
          connectionNonce = frame.nonce + 1;
          lastCommand = 'HELLO';
          
          // Send HELLO_ACK
          sendResponse(socket, RESPONSES.HELLO_ACK, connectionNonce, '');
          connectionNonce++;
          break;
        
        case COMMANDS.DUMP:
          // First DUMP -> DUMP_FAILED, second DUMP -> DUMP_OK
          if (lastCommand !== 'HELLO' && lastCommand !== 'DUMP') {
            console.log('[ERROR] DUMP must follow HELLO or DUMP');
            socket.destroy();
            return;
          }
          
          lastCommand = 'DUMP';
          connectionNonce = frame.nonce + 1;
          
          if (dumpCount === 0) {
            // First DUMP -> DUMP_FAILED
            dumpCount++;
            sendResponse(socket, RESPONSES.DUMP_FAILED, connectionNonce, '');
          } else {
            // Second DUMP -> DUMP_OK with override code
            sendResponse(socket, RESPONSES.DUMP_OK, connectionNonce, 'CPE1704TKS');
          }
          connectionNonce++;
          break;
        
        case COMMANDS.STOP_CMD:
          lastCommand = 'STOP_CMD';
          connectionNonce = frame.nonce + 1;
          
          // Send STOP_OK
          sendResponse(socket, RESPONSES.STOP_OK, connectionNonce, '');
          
          // Close connection
          setTimeout(() => {
            socket.end();
          }, 100);
          break;
        
        default:
          console.log(`[ERROR] Unknown command: ${frame.cmd}`);
          socket.destroy();
      }
    } catch (error) {
      console.error(`[ERROR] ${error.message}`);
      socket.destroy();
    }
  });
  
  socket.on('timeout', () => {
    console.log('Client connection timed out');
    socket.destroy();
  });
  
  socket.on('error', (error) => {
    console.error(`Socket error: ${error.message}`);
  });
  
  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

/**
 * Send a response to the client
 * @param {net.Socket} socket - Client socket
 * @param {number} cmd - Response command code
 * @param {number} nonce - Response nonce
 * @param {string} payload - Response payload
 */
function sendResponse(socket, cmd, nonce, payload) {
  const response = encodeFrame(cmd, nonce, payload);
  socket.write(response);
  console.log(`[SENT] ${cmd} (nonce=${nonce})`);
}

// Export for testing
module.exports = {
  start: (port) => {
    server.listen(port, () => {
      console.log(`Mock server listening on port ${port}`);
    });
    return server;
  },
  stop: () => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  }
};