#!/bin/bash
while true; do
  if ! curl -s -m 3 http://localhost:3000/ > /dev/null 2>&1; then
    pkill -f "next dev" 2>/dev/null
    pkill -f "next start" 2>/dev/null
    sleep 1
    cd /home/z/my-project && npx next dev -p 3000 > /dev/null 2>&1 &
    sleep 5
  fi
  sleep 5
done
