#!/bin/zsh
# run.sh name slot [size]: one image with the style reference, retried after a minute when the rate limit answers
cd "$(dirname "$0")"; X='{"background":"transparent","quality":"high","images":["refs/style-qi.png"]}'
for i in 1 2 3 4; do python3 gen.py "$1" "prompts/$2-r.txt" "${3:-1536x1024}" "$X"; r=$?; [ $r -ne 2 ] && exit $r; sleep 65; done
