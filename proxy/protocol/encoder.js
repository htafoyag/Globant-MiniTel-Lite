/**
 * MiniTel-Lite Protocol Encoder
 * Handles frame encoding according to the protocol specification
 */

const crypto = require('crypto');

/**
 * Encodes a MiniTel-Lite frame according to protocol specs
 * 
 * Encoding process:
 * 1. Build binary frame: CMD + NONCE + PAYLOAD + HASH
 * 2. Calculate hash: SHA-256(CMD + NONCE + PAYLOAD)
 * 3. Base64 encode the complete frame
 * 4. Prepend 2-byte length prefix (big-endian)
 * 
 * @param {number} cmd - Command code (1 byte)
 * @param {number} nonce - Nonce value (4 bytes, big-endian)
 * @param {string} payload - Payload string (UTF-8 encoded)
 * @returns {Buffer} - Fully encoded frame ready for transmission
 */
function encodeFrame(cmd, nonce, payload = '') {
  // Convert payload to Buffer if it's a string
  const payloadBuffer = Buffer.from(payload, 'utf8');
  
  // Create buffer for CMD + NONCE + PAYLOAD
  const dataBuffer = Buffer.alloc(1 + 4 + payloadBuffer.length);
  
  // Write CMD (1 byte)
  dataBuffer.writeUInt8(cmd, 0);
  
  // Write NONCE (4 bytes, big-endian)
  dataBuffer.writeUInt32BE(nonce, 1);
  
  // Write PAYLOAD
  payloadBuffer.copy(dataBuffer, 5);
  
  // Calculate SHA-256 hash
  const hash = crypto.createHash('sha256').update(dataBuffer).digest();
  
  // Combine data and hash
  const frameBuffer = Buffer.concat([dataBuffer, hash]);
  
  // Base64 encode the frame
  const base64Frame = frameBuffer.toString('base64');
  
  // Create final frame with length prefix
  const finalFrame = Buffer.alloc(2 + base64Frame.length);
  
  // Write length prefix (2 bytes, big-endian)
  finalFrame.writeUInt16BE(base64Frame.length, 0);
  
  // Write Base64 data
  finalFrame.write(base64Frame, 2);
  
  return finalFrame;
}

module.exports = {
  encodeFrame
};