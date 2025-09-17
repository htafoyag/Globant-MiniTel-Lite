/**
 * MiniTel-Lite Nonce Management
 * Handles nonce sequence tracking and validation
 */

class NonceManager {
  constructor() {
    this.reset();
  }

  /**
   * Reset nonce state (called on new connection or HELLO)
   */
  reset() {
    this.clientNonce = 0; // Initial client nonce is 0
    this.serverNonce = null; // Server nonce starts as null
  }

  /**
   * Get the current client nonce value
   * @returns {number} - Current client nonce
   */
  getCurrentClientNonce() {
    return this.clientNonce;
  }

  /**
   * Get the expected server nonce (for validation)
   * @returns {number|null} - Expected server nonce or null if not set
   */
  getExpectedServerNonce() {
    return this.serverNonce;
  }

  /**
   * Calculate next client nonce based on last server nonce
   * Client next nonce = last server nonce + 1
   * @returns {number} - Next client nonce to use
   */
  getNextClientNonce() {
    if (this.serverNonce === null) {
      // Initial case, use 0
      return 0;
    }
    return this.serverNonce + 1;
  }

  /**
   * Update client nonce (after sending a message)
   * @param {number} nonce - The nonce value used in the client message
   */
  updateClientNonce(nonce) {
    this.clientNonce = nonce;
    // Calculate expected server response nonce
    this.serverNonce = nonce + 1;
  }

  /**
   * Validate server nonce against expected value
   * @param {number} nonce - Server nonce to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  validateServerNonce(nonce) {
    return nonce === this.serverNonce;
  }

  /**
   * Update server nonce after receiving server message
   * @param {number} nonce - Server nonce received
   */
  updateServerNonce(nonce) {
    this.serverNonce = nonce;
  }
}

module.exports = NonceManager;