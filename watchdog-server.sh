#!/bin/bash
while true; do
    if ! pgrep -f "custom-server.py" > /dev/null; then
        echo "$(date): Starting custom-server..." >> /tmp/server-watchdog.log
        (setsid python3 /home/z/my-project/custom-server.py > /tmp/server-daemon.log 2>&1 &)
        sleep 3
    fi
    sleep 10
done
