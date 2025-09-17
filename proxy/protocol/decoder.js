/**
 * MiniTel-Lite Protocol Decoder
 * Handles frame decoding according to the protocol specification
 */

const crypto = require('crypto');
const { COMMAND_NAMES } = require('./constants');

/**
 * Decodes a MiniTel-Lite frame according to protocol specs
 * 
 * Decoding process:
 * 1. Read 2-byte length prefix
 * 2. Read exactly length bytes of Base64 data
 * 3. Base64 decode to get binary frame
 * 4. Extract CMD, NONCE, PAYLOAD, HASH
 * 5. Verify hash: SHA-256(CMD + NONCE + PAYLOAD)
 * 6. Reject frame if hash validation fails
 * 
 * @param {Buffer} data - Raw frame data received from socket
 * @returns {Object|null} - Decoded frame or null if invalid
 */
function decodeFrame(data) {
  try {
    // Minimum frame size check (2 bytes for length + some Base64 data)
    if (data.length < 3) {
      throw new Error('Frame too short to contain length prefix');
    }
    
    // Extract length prefix (2 bytes, big-endian)
    const base64Length = data.readUInt16BE(0);
    
    // Check if we have enough data
    if (data.length < 2 + base64Length) {
      throw new Error(`Incomplete frame: expected ${base64Length} Base64 bytes, got ${data.length - 2}`);
    }
    
    // Extract Base64 data
    const base64Data = data.toString('utf8', 2, 2 + base64Length);
    
    // Base64 decode to get binary frame
    const binaryFrame = Buffer.from(base64Data, 'base64');
    
    // Minimum decoded frame length = 37 bytes (1+4+0+32)
    if (binaryFrame.length < 37) {
      throw new Error('Decoded frame too short (minimum 37 bytes)');
    }
    
    // Extract CMD (1 byte)
    const cmd = binaryFrame.readUInt8(0);
    
    // Extract NONCE (4 bytes, big-endian)
    const nonce = binaryFrame.readUInt32BE(1);
    
    // Extract HASH (last 32 bytes)
    const hash = binaryFrame.slice(binaryFrame.length - 32);
    
    // Extract PAYLOAD (everything between NONCE and HASH)
    const payload = binaryFrame.slice(5, binaryFrame.length - 32);
    
    // Verify hash
    const dataToHash = binaryFrame.slice(0, binaryFrame.length - 32);
    const calculatedHash = crypto.createHash('sha256').update(dataToHash).digest();
    
    // Compare calculated hash with received hash
    if (!calculatedHash.equals(hash)) {
      throw new Error('Hash validation failed');
    }
    
    // Return decoded frame
    return {
      cmd,
      cmdName: COMMAND_NAMES[cmd] || 'UNKNOWN',
      nonce,
      payload: payload.toString('utf8'),
      valid: true
    };
  } catch (error) {
    console.error(`[DECODE ERROR] ${error.message}`);
    return {
      error: error.message,
      valid: false
    };
  }
}

module.exports = {
  decodeFrame
};