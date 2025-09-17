#!/bin/bash

echo "Running MiniTel-Lite Tests"
echo "=========================="

# Make script executable
chmod +x run_tests.sh

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run tests
echo "Running tests..."
npm test

exit_code=$?
if [ $exit_code -eq 0 ]; then
  echo "All tests passed! 🎉"
else
  echo "Tests failed with exit code $exit_code 😞"
fi

exit $exit_code