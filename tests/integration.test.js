/**
 * MiniTel-Lite Integration Tests
 * Tests the client protocol against a mock server
 */

const chai = require('chai');
const expect = chai.expect;
const net = require('net');
const mockServer = require('./mock-server');
const { encodeFrame } = require('../proxy/protocol/encoder');
const { decodeFrame } = require('../proxy/protocol/decoder');
const { COMMANDS, RESPONSES } = require('../proxy/protocol/constants');
const NonceManager = require('../proxy/protocol/nonce');

describe('MiniTel-Lite Integration', function() {
  // Increase timeout for integration tests
  this.timeout(10000);
  
  const TEST_PORT = 7322;
  let server;
  let client;
  let nonceManager;
  
  before(async () => {
    // Start the mock server
    server = mockServer.start(TEST_PORT);
  });
  
  after(async () => {
    // Stop the mock server
    await mockServer.stop();
  });
  
  beforeEach(() => {
    // Initialize nonce manager
    nonceManager = new NonceManager();
  });
  
  afterEach(() => {
    // Close client connection if open
    if (client && !client.destroyed) {
      client.destroy();
    }
  });
  
  /**
   * Send a command to the server and wait for response
   * @param {number} cmd - Command code
   * @param {string} payload - Command payload
   * @returns {Promise<Object>} - Decoded response
   */
  function sendCommand(cmd, payload = '') {
    return new Promise((resolve, reject) => {
      // Get next nonce
      const nonce = nonceManager.getNextClientNonce();
      
      // Encode frame
      const frame = encodeFrame(cmd, nonce, payload);
      
      // Update client nonce
      nonceManager.updateClientNonce(nonce);
      
      // Set up response handler
      const responseHandler = (data) => {
        try {
          // Decode response
          const response = decodeFrame(data);
          
          if (!response.valid) {
            return reject(new Error(`Invalid response: ${response.error}`));
          }
          
          // Validate nonce
          if (!nonceManager.validateServerNonce(response.nonce)) {
            return reject(new Error(`Nonce mismatch: expected=${nonceManager.getExpectedServerNonce()}, got=${response.nonce}`));
          }
          
          // Update server nonce
          nonceManager.updateServerNonce(response.nonce);
          
          // Remove handler
          client.removeListener('data', responseHandler);
          
          // Resolve with response
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        client.removeListener('data', responseHandler);
        reject(new Error('Response timeout'));
      }, 2000);
      
      // Set up error handler
      const errorHandler = (error) => {
        clearTimeout(timeoutId);
        client.removeListener('data', responseHandler);
        reject(error);
      };
      
      // Listen for response
      client.once('error', errorHandler);
      client.on('data', responseHandler);
      
      // Send command
      client.write(frame);
    });
  }
  
  /**
   * Connect to the mock server
   * @returns {Promise<net.Socket>} - Connected socket
   */
  function connectToServer() {
    return new Promise((resolve, reject) => {
      // Create socket
      client = new net.Socket();
      
      // Set up event handlers
      client.on('connect', () => {
        resolve(client);
      });
      
      client.on('error', (error) => {
        reject(error);
      });
      
      // Connect to server
      client.connect(TEST_PORT, 'localhost');
    });
  }
  
  it('should handle HELLO command correctly', async () => {
    // Connect to server
    await connectToServer();
    
    // Send HELLO command
    const response = await sendCommand(COMMANDS.HELLO);
    
    // Verify response
    expect(response.cmd).to.equal(RESPONSES.HELLO_ACK);
    expect(response.nonce).to.equal(1);
  });
  
  it('should handle first DUMP command correctly', async () => {
    // Connect to server
    await connectToServer();
    
    // Send HELLO command
    await sendCommand(COMMANDS.HELLO);
    
    // Send first DUMP command
    const response = await sendCommand(COMMANDS.DUMP);
    
    // Verify response
    expect(response.cmd).to.equal(RESPONSES.DUMP_FAILED);
  });
  
  it('should handle second DUMP command correctly', async () => {
    // Connect to server
    await connectToServer();
    
    // Send HELLO command
    await sendCommand(COMMANDS.HELLO);
    
    // Send first DUMP command
    await sendCommand(COMMANDS.DUMP);
    
    // Send second DUMP command
    const response = await sendCommand(COMMANDS.DUMP);
    
    // Verify response
    expect(response.cmd).to.equal(RESPONSES.DUMP_OK);
    expect(response.payload).to.equal('CPE1704TKS');
  });
  
  it('should handle the complete HELLO -> DUMP -> DUMP -> STOP_CMD sequence', async () => {
    // Connect to server
    await connectToServer();
    
    // Send HELLO command
    const helloResponse = await sendCommand(COMMANDS.HELLO);
    expect(helloResponse.cmd).to.equal(RESPONSES.HELLO_ACK);
    
    // Send first DUMP command
    const dumpFailedResponse = await sendCommand(COMMANDS.DUMP);
    expect(dumpFailedResponse.cmd).to.equal(RESPONSES.DUMP_FAILED);
    
    // Send second DUMP command
    const dumpOkResponse = await sendCommand(COMMANDS.DUMP);
    expect(dumpOkResponse.cmd).to.equal(RESPONSES.DUMP_OK);
    expect(dumpOkResponse.payload).to.equal('CPE1704TKS');
    
    // Send STOP_CMD command
    const stopResponse = await sendCommand(COMMANDS.STOP_CMD);
    expect(stopResponse.cmd).to.equal(RESPONSES.STOP_OK);
  });
  
  it('should reject frames with incorrect nonce', async () => {
    // Connect to server
    await connectToServer();
    
    // Send HELLO command
    await sendCommand(COMMANDS.HELLO);
    
    // Create a frame with incorrect nonce
    const incorrectNonce = nonceManager.getNextClientNonce() + 1;
    const frame = encodeFrame(COMMANDS.DUMP, incorrectNonce);
    
    // Send frame and expect disconnection
    const disconnectPromise = new Promise((resolve) => {
      client.once('close', () => {
        resolve();
      });
    });
    
    client.write(frame);
    
    // Wait for disconnection
    await disconnectPromise;
    
    // Verify client is disconnected
    expect(client.destroyed).to.be.true;
  });
});