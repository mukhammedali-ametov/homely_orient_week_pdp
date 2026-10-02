#!/bin/bash
cd "$(dirname "$0")"
if lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  open "http://127.0.0.1:8080"
  echo "Homely allaqachon ochiq: http://127.0.0.1:8080"
  echo "Foydalanuvchi: zulfiya / mehr2026"
  echo "Admin: admin / homely2026"
  exit 0
fi
ruby server.rb &
PID=$!
trap 'kill $PID 2>/dev/null' INT TERM
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -sf -o /dev/null "http://127.0.0.1:8080/api/health"; then
    break
  fi
  sleep 0.25
done
open "http://127.0.0.1:8080"
wait $PID
