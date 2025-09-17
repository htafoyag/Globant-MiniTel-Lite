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
    // If already recording, stop the current recording first
    if (this.active) {
      this.stopRecording();
    }

    // Generate unique session ID based on timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, 'Z');
    const sessionId = timestamp;
    this.recordingFile = path.join(RECORDING.DIR, `session-${sessionId}.json`);

    // Create recordings directory if it doesn't exist
    if (!fs.existsSync(RECORDING.DIR)) {
      fs.mkdirSync(RECORDING.DIR, { recursive: true });
    }

    // Initialize session data with empty steps
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

    // Update end time and write final version
    this.sessionData.end_time = new Date().toISOString();
    
    // Write the final session data
    try {
      fs.writeFileSync(
        this.recordingFile,
        JSON.stringify(this.sessionData, null, 2),
        'utf8'
      );
      console.log(`[RECORDER] Finalized recording at ${this.recordingFile}`);
    } catch (error) {
      console.error(`[RECORDER] Error finalizing recording: ${error.message}`);
      return false;
    }

    // Store the file path before clearing
    const filePath = this.recordingFile;
    
    // Reset recorder state
    this.active = false;
    this.sessionData = null;
    this.recordingFile = null;
    
    console.log(`[RECORDER] Session recording complete: ${filePath}`);
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
    const step = {
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
    };
    
    // Add step to in-memory collection
    this.sessionData.steps.push(step);
    
    // Write updated file to disk immediately
    this._writeSessionData();
  }

  /**
   * Record a server response
   * @param {Buffer} rawData - Raw frame data received from server
   * @param {Object} decodedData - Decoded frame data
   */
  recordResponse(rawData, decodedData) {
    if (!this.active) return;

    this.currentStep++;
    const step = {
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
    };
    
    // Add step to in-memory collection
    this.sessionData.steps.push(step);
    
    // Write updated file to disk immediately
    this._writeSessionData();
  }
  
  /**
   * Private helper to write the current session data to disk
   * Updates the file with the latest steps after each interaction
   * @private
   */
  _writeSessionData() {
    if (!this.active || !this.recordingFile) return;
    
    try {
      // Update end time to current time (will be overwritten on next write)
      this.sessionData.end_time = new Date().toISOString();
      
      // Write the entire session data to file
      fs.writeFileSync(
        this.recordingFile,
        JSON.stringify(this.sessionData, null, 2),
        'utf8'
      );
      
      // Log every few steps to avoid console spam
      if (this.currentStep % 2 === 0) {
        console.log(`[RECORDER] Updated recording file with step ${this.currentStep}`);
      }
    } catch (error) {
      console.error(`[RECORDER] Error updating recording file: ${error.message}`);
    }
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