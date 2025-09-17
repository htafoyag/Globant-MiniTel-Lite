/**
 * MiniTel-Lite Session Recorder
 * Records client-server interactions for later replay
 */

const fs = require('fs');
const path = require('path');
const { RECORDING, SERVER } = require('../protocol/constants');

class SessionRecorder {
  constructor() {
    this.active = false;
    this.sessionData = null;
    this.recordingFile = null;
  }

  /**
   * Start a new recording session
   * @returns {boolean} - True if recording started successfully
   */
  startRecording() {
    // Check if already recording
    if (this.active) {
      console.log('[RECORDER] Already recording');
      return false;
    }

    // Generate unique session ID based on timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, 'Z');
    const sessionId = timestamp;
    this.recordingFile = path.join(RECORDING.DIR, `session-${sessionId}.json`);

    // Create recordings directory if it doesn't exist
    if (!fs.existsSync(RECORDING.DIR)) {
      fs.mkdirSync(RECORDING.DIR, { recursive: true });
    }

    // Initialize session data
    this.sessionData = {
      session_id: sessionId,
      start_time: new Date().toISOString(),
      end_time: null,
      server_host: SERVER.HOST,
      server_port: SERVER.PORT,
      steps: []
    };

    this.active = true;
    this.currentStep = 0;
    
    console.log(`[RECORDER] Started recording session ${sessionId}`);
    return true;
  }

  /**
   * Stop the current recording session
   * @returns {boolean} - True if recording stopped successfully
   */
  stopRecording() {
    if (!this.active) {
      console.log('[RECORDER] Not recording');
      return false;
    }

    // Update end time
    this.sessionData.end_time = new Date().toISOString();

    // Write session data to file
    try {
      fs.writeFileSync(
        this.recordingFile,
        JSON.stringify(this.sessionData, null, 2),
        'utf8'
      );
      console.log(`[RECORDER] Saved recording to ${this.recordingFile}`);
    } catch (error) {
      console.error(`[RECORDER] Error saving recording: ${error.message}`);
      return false;
    }

    this.active = false;
    this.sessionData = null;
    this.recordingFile = null;
    
    return true;
  }

  /**
   * Record a client request
   * @param {Buffer} rawData - Raw frame data sent to server
   * @param {Object} decodedData - Decoded frame data
   */
  recordRequest(rawData, decodedData) {
    if (!this.active) return;

    this.currentStep++;
    this.sessionData.steps.push({
      step: this.currentStep,
      timestamp: new Date().toISOString(),
      direction: 'client',
      request: rawData.toString('base64'),
      response: null,
      decoded: {
        cmd: decodedData.cmdName,
        nonce: decodedData.nonce,
        payload: decodedData.payload
      },
      valid: decodedData.valid
    });
  }

  /**
   * Record a server response
   * @param {Buffer} rawData - Raw frame data received from server
   * @param {Object} decodedData - Decoded frame data
   */
  recordResponse(rawData, decodedData) {
    if (!this.active) return;

    this.currentStep++;
    this.sessionData.steps.push({
      step: this.currentStep,
      timestamp: new Date().toISOString(),
      direction: 'server',
      request: null,
      response: rawData.toString('base64'),
      decoded: {
        cmd: decodedData.cmdName,
        nonce: decodedData.nonce,
        payload: decodedData.payload
      },
      valid: decodedData.valid
    });
  }

  /**
   * Check if recording is active
   * @returns {boolean} - True if recording
   */
  isRecording() {
    return this.active;
  }
}

module.exports = SessionRecorder;