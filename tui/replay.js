#!/usr/bin/env node
/**
 * MiniTel-Lite TUI Session Replay Tool
 * Provides a terminal-based replay of recorded sessions
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { terminal } = require('terminal-kit');

// Check if file path was provided
if (process.argv.length < 3) {
  console.error('Error: No session file specified');
  console.error('Usage: node replay.js <path/to/session.json>');
  process.exit(1);
}

// Get file path from command line arguments
const filePath = process.argv[2];

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

// Load session data
let sessionData;
try {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  sessionData = JSON.parse(fileContent);
} catch (error) {
  console.error(`Error reading session file: ${error.message}`);
  process.exit(1);
}

// Initialize state
let currentStep = 0;
const totalSteps = sessionData.steps.length;

// Set up terminal
terminal.clear();
terminal.hideCursor();

// Handle terminal resize
process.stdout.on('resize', renderScreen);

// Set up keyboard input
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

// Listen for keypresses
process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
    exitApplication();
  }
  
  switch (key.name.toLowerCase()) {
    case 'n':
      nextStep();
      break;
    case 'p':
      previousStep();
      break;
    case 'q':
      exitApplication();
      break;
  }
});

// Render the initial screen
renderScreen();

/**
 * Render the TUI screen
 */
function renderScreen() {
  terminal.clear();
  
  // Get terminal dimensions
  const { width, height } = terminal;
  
  // Draw header
  terminal.bold.cyan('\n  MiniTel-Lite Session Replay Tool\n');
  terminal.yellow(`  File: ${path.basename(filePath)}\n`);
  terminal.yellow(`  Session ID: ${sessionData.session_id}\n`);
  terminal.yellow(`  Server: ${sessionData.server_host}:${sessionData.server_port}\n`);
  terminal.yellow(`  Duration: ${formatDuration(sessionData.start_time, sessionData.end_time)}\n\n`);
  
  // Draw step navigation
  terminal.bold(`  Step ${currentStep + 1}/${totalSteps}`);
  terminal.gray('  (N: next, P: previous, Q: quit)\n\n');
  
  // Draw current step content
  if (totalSteps > 0) {
    const step = sessionData.steps[currentStep];
    
    terminal.bold('  Timestamp: ');
    terminal.white(`${formatTimestamp(step.timestamp)}\n\n`);
    
    terminal.bold(`  Direction: `);
    terminal.white(`${step.direction === 'client' ? 'Client → Server' : 'Server → Client'}\n\n`);
    
    // Command and nonce
    terminal.bold('  Command: ');
    terminal.white(`${step.decoded.cmd} (nonce=${step.decoded.nonce})\n\n`);
    
    // Draw request or response section based on direction
    if (step.direction === 'client') {
      drawDataSection('Request', step.request, step.decoded.payload);
    } else {
      drawDataSection('Response', step.response, step.decoded.payload);
    }
  } else {
    terminal.red('\n  No steps found in session data\n');
  }
  
  // Draw footer
  const footerY = height - 2;
  terminal.moveTo(1, footerY);
  terminal.bold.gray('  Press Q to quit, N for next step, P for previous step');
}

/**
 * Draw a data section (request or response)
 * @param {string} title - Section title
 * @param {string} rawData - Raw Base64 data
 * @param {string} payload - Decoded payload
 */
function drawDataSection(title, rawData, payload) {
  const { width } = terminal;
  const contentWidth = width - 4; // Allow for margins
  
  terminal.bold(`  ${title} Data:\n`);
  
  // Draw raw data (truncated)
  terminal.white('  ');
  terminal.gray('Raw: ');
  if (rawData && rawData.length > 0) {
    const truncatedData = rawData.length > contentWidth - 10
      ? rawData.substring(0, contentWidth - 13) + '...'
      : rawData;
    terminal.white(`${truncatedData}\n`);
  } else {
    terminal.gray('(empty)\n');
  }
  
  // Draw decoded payload
  terminal.white('  ');
  terminal.gray('Payload: ');
  if (payload && payload.length > 0) {
    terminal.white(`"${payload}"\n`);
  } else {
    terminal.gray('(empty)\n');
  }
  
  terminal.white('\n');
}

/**
 * Move to the next step
 */
function nextStep() {
  if (currentStep < totalSteps - 1) {
    currentStep++;
    renderScreen();
  } else {
    // Flash to indicate end of steps
    terminal.bold.red('\n  End of session reached\n');
    setTimeout(renderScreen, 500);
  }
}

/**
 * Move to the previous step
 */
function previousStep() {
  if (currentStep > 0) {
    currentStep--;
    renderScreen();
  } else {
    // Flash to indicate beginning of steps
    terminal.bold.red('\n  Beginning of session reached\n');
    setTimeout(renderScreen, 500);
  }
}

/**
 * Format a timestamp for display
 * @param {string} timestamp - ISO timestamp
 * @returns {string} - Formatted timestamp
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Calculate and format duration between two timestamps
 * @param {string} start - Start time ISO string
 * @param {string} end - End time ISO string
 * @returns {string} - Formatted duration
 */
function formatDuration(start, end) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const durationMs = endTime - startTime;
  
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Exit the application
 */
function exitApplication() {
  terminal.clear();
  terminal.showCursor();
  terminal.grabInput(false);
  process.exit(0);
}