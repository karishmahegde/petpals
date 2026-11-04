#!/bin/sh
# Render's start command (render.yaml → dockerCommand: sh migrate-and-start.sh).
# Applies any pending migrations, then replaces this shell with the API, so
# node receives the host's stop signal directly. Kept as a script because
# Render passes quotes in dockerCommand through literally — `sh -c "a && b"`
# there runs a program named "a && b".
set -e
npx prisma migrate deploy
exec node src/index.js
