/**
 * MiniTel-Lite Override Terminal Frontend
 * Provides a user interface for interacting with the MiniTel-Lite proxy
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const hackButton = document.getElementById('hack-button');
  const outputEl = document.getElementById('output');
  const recordingToggle = document.getElementById('recording-toggle');
  const connectionStatus = document.getElementById('connection-status');
  const overrideCodeContainer = document.getElementById('override-code-container');
  const overrideCodeEl = document.getElementById('override-code');

  // WebSocket connection
  let ws;
  let isConnecting = false;
  let isHacking = false;

  // Initialize the application
  initializeApp();

  /**
   * Initialize the application and WebSocket connection
   */
  function initializeApp() {
    // Clear output and override code
    clearOutput();
    overrideCodeEl.textContent = '';
    
    // Reset state
    isHacking = false;
    
    // Initialize WebSocket
    connectWebSocket();
    
    // Set up event listeners
    hackButton.addEventListener('click', startHack);
    recordingToggle.addEventListener('change', toggleRecording);
    
    // Set initial UI state
    updateConnectionStatus('disconnected');
  }

  /**
   * Connect to the WebSocket server
   */
  function connectWebSocket() {
    // Close existing connection if any
    if (ws) {
      ws.close();
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      updateConnectionStatus('connected');
    };
    
    ws.onmessage = (event) => {
      handleMessage(JSON.parse(event.data));
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      updateConnectionStatus('disconnected');
      
      // If we're in the middle of a hack and the connection is lost
      if (isHacking) {
        // Just report the error and reset the hack state
        addMessage('Connection lost during hack sequence. Please try again.', 'error');
        isHacking = false;
        hackButton.disabled = false;
      }
      
      // No automatic reconnection - user must click HACK again
      // or refresh the page to reconnect
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      addMessage('WebSocket error. Please check if the proxy server is running.', 'error');
      scrollOutputToBottom();
    };
  }

  /**
   * Handle messages from the WebSocket server
   * @param {Object} data - Message data
   */
  function handleMessage(data) {
    console.log('Received message:', data);
    
    switch (data.type) {
      case 'status':
        handleStatusUpdate(data);
        break;
      
      case 'update':
        addMessage(data.message);
        break;
      
      case 'error':
        addMessage(data.message, 'error');
        
        // Reset hack state if we were hacking
        if (isHacking) {
          isHacking = false;
          hackButton.disabled = false;
        }
        break;
      
      case 'success':
        addMessage(data.message, 'success');
        if (data.overrideCode) {
          displayOverrideCode(data.overrideCode);
        }
        
        // Reset hack state
        isHacking = false;
        hackButton.disabled = false;
        break;
      
      default:
        console.warn('Unknown message type:', data.type);
    }
    
    // Ensure the output area is scrolled to the bottom after any message
    scrollOutputToBottom();
  }

  /**
   * Handle status updates from the server
   * @param {Object} data - Status data
   */
  function handleStatusUpdate(data) {
    // Update recording toggle
    recordingToggle.checked = data.recording;
    
    // Update connection status
    updateConnectionStatus(data.connected ? 'connected' : 'disconnected');
    
    // Update override code if available
    if (data.overrideCode) {
      displayOverrideCode(data.overrideCode);
    }
    
    // Display status message if provided
    if (data.message) {
      addMessage(data.message);
      scrollOutputToBottom();
    }
  }

  /**
   * Start the hack sequence
   */
  function startHack() {
    // Check if WebSocket is available and connected
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      clearOutput();
      addMessage('Server not connected. Please ensure the server is running.', 'error');
      
      // Try to establish connection if it doesn't exist or is closed
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        addMessage('Attempting to connect to server...', 'error');
        connectWebSocket();
      }
      return;
    }
    
    // Already hacking - prevent multiple attempts
    if (isHacking) {
      return;
    }
    
    // Reset state for new hack attempt
    isHacking = true;
    hackButton.disabled = true;
    
    clearOutput();
    addMessage('Initiating hack sequence...');
    
    // Send hack command to server
    ws.send(JSON.stringify({
      command: 'hack'
    }));
  }

  /**
   * Toggle session recording
   */
  function toggleRecording() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Reset the toggle to its previous state
      recordingToggle.checked = !recordingToggle.checked;
      
      // Show an error message
      addMessage('Server not connected. Cannot toggle recording.', 'error');
      
      // Try to establish connection if it doesn't exist or is closed
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        addMessage('Attempting to connect to server...', 'error');
        connectWebSocket();
      }
      return;
    }
    
    const isRecording = recordingToggle.checked;
    
    ws.send(JSON.stringify({
      command: 'toggleRecording',
      enable: isRecording
    }));
    
    // Status message will come from the server
  }

  /**
   * Update the connection status indicator
   * @param {string} status - Connection status (connected, disconnected, connecting)
   */
  function updateConnectionStatus(status) {
    connectionStatus.className = 'status-light';
    connectionStatus.classList.add(`status-${status}`);
  }

  /**
   * Add a message to the output area
   * @param {string} message - Message text
   * @param {string} type - Message type (error, success, or empty for normal)
   */
  function addMessage(message, type = '') {
    const msgEl = document.createElement('div');
    msgEl.className = 'message';
    if (type) {
      msgEl.classList.add(type);
    }
    
    const timestamp = new Date().toLocaleTimeString();
    msgEl.textContent = `[${timestamp}] ${message}`;
    
    outputEl.appendChild(msgEl);
    
    // Scroll to bottom
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  /**
   * Clear the output area
   */
  function clearOutput() {
    outputEl.innerHTML = '';
  }

  /**
   * Display the override code
   * @param {string} code - Override code
   */
  function displayOverrideCode(code) {
    overrideCodeEl.textContent = code;
    overrideCodeContainer.style.display = 'flex';
  }
  
  /**
   * Scroll the output area to the bottom
   * Uses a small delay to ensure content is fully rendered before scrolling
   */
  function scrollOutputToBottom() {
    if (outputEl) {
      // Immediate scroll
      outputEl.scrollTop = outputEl.scrollHeight;
      
      // Add a slight delay to ensure it works even if content is still rendering
      setTimeout(() => {
        outputEl.scrollTop = outputEl.scrollHeight;
      }, 10);
    }
  }
});