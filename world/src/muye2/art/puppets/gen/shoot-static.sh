#!/bin/sh
# Shoot review sheets without the dev server: serves world/ on a spare port for the length of the shoot.  sh gen/shoot-static.sh faxiang ranks ...
cd "$(dirname "$0")/../../../../.." && python3 -m http.server 5199 --bind 127.0.0.1 >/dev/null 2>&1 & PID=$!
sleep 1; SHEET_BASE=http://127.0.0.1:5199 node "$(dirname "$0")/shoot.mjs" "$@"; kill $PID
