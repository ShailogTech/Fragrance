#!/bin/bash
cd /home/z/my-project
while true; do
  npx next dev -p 3000 2>&1 | tee dev.log &
  SERVER_PID=$!
  # Wait for server to be ready
  for i in $(seq 1 30); do
    if curl -s -m 2 http://localhost:3000/ > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  # Keep running until server dies
  wait $SERVER_PID 2>/dev/null
  echo "Server died, restarting in 3 seconds..."
  sleep 3
done
