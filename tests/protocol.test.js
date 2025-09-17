/**
 * MiniTel-Lite Protocol Tests
 * Tests protocol encoding, decoding, and nonce handling
 */

const chai = require('chai');
const expect = chai.expect;
const { encodeFrame } = require('../proxy/protocol/encoder');
const { decodeFrame } = require('../proxy/protocol/decoder');
const NonceManager = require('../proxy/protocol/nonce');
const { COMMANDS, RESPONSES } = require('../proxy/protocol/constants');

describe('MiniTel-Lite Protocol', () => {
  describe('Frame Encoding and Decoding', () => {
    it('should correctly encode and decode a frame with empty payload', () => {
      const cmd = COMMANDS.HELLO;
      const nonce = 0;
      const payload = '';
      
      // Encode the frame
      const encodedFrame = encodeFrame(cmd, nonce, payload);
      
      // Decode the frame
      const decodedFrame = decodeFrame(encodedFrame);
      
      // Verify decoded values
      expect(decodedFrame.valid).to.be.true;
      expect(decodedFrame.cmd).to.equal(cmd);
      expect(decodedFrame.nonce).to.equal(nonce);
      expect(decodedFrame.payload).to.equal(payload);
    });
    
    it('should correctly encode and decode a frame with non-empty payload', () => {
      const cmd = COMMANDS.HELLO;
      const nonce = 42;
      const payload = 'test payload';
      
      // Encode the frame
      const encodedFrame = encodeFrame(cmd, nonce, payload);
      
      // Decode the frame
      const decodedFrame = decodeFrame(encodedFrame);
      
      // Verify decoded values
      expect(decodedFrame.valid).to.be.true;
      expect(decodedFrame.cmd).to.equal(cmd);
      expect(decodedFrame.nonce).to.equal(nonce);
      expect(decodedFrame.payload).to.equal(payload);
    });
    
    it('should detect tampered frames', () => {
      const cmd = COMMANDS.HELLO;
      const nonce = 1;
      const payload = '';
      
      // Encode the frame
      const encodedFrame = encodeFrame(cmd, nonce, payload);
      
      // Tamper with the frame (change a byte in the middle)
      encodedFrame[10] = (encodedFrame[10] + 1) % 256;
      
      // Decode the frame
      const decodedFrame = decodeFrame(encodedFrame);
      
      // Verify the frame is detected as invalid
      expect(decodedFrame.valid).to.be.false;
    });
  });
  
  describe('Nonce Management', () => {
    let nonceManager;
    
    beforeEach(() => {
      nonceManager = new NonceManager();
    });
    
    it('should initialize with client nonce 0', () => {
      expect(nonceManager.getCurrentClientNonce()).to.equal(0);
    });
    
    it('should calculate correct next client nonce', () => {
      // Initial state
      expect(nonceManager.getNextClientNonce()).to.equal(0);
      
      // After server response with nonce 1
      nonceManager.updateServerNonce(1);
      expect(nonceManager.getNextClientNonce()).to.equal(2);
      
      // After sending client message with nonce 2
      nonceManager.updateClientNonce(2);
      expect(nonceManager.getExpectedServerNonce()).to.equal(3);
    });
    
    it('should validate server nonce correctly', () => {
      // Send client message with nonce 0
      nonceManager.updateClientNonce(0);
      
      // Expected server nonce should be 1
      expect(nonceManager.validateServerNonce(1)).to.be.true;
      expect(nonceManager.validateServerNonce(2)).to.be.false;
      
      // Update server nonce
      nonceManager.updateServerNonce(1);
      
      // Next client nonce should be 2
      expect(nonceManager.getNextClientNonce()).to.equal(2);
    });
    
    it('should reset nonce state correctly', () => {
      // Set up some state
      nonceManager.updateClientNonce(10);
      nonceManager.updateServerNonce(11);
      
      // Reset
      nonceManager.reset();
      
      // Check reset state
      expect(nonceManager.getCurrentClientNonce()).to.equal(0);
      expect(nonceManager.getExpectedServerNonce()).to.be.null;
      expect(nonceManager.getNextClientNonce()).to.equal(0);
    });
  });
});