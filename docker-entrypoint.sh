#!/bin/sh
set -e

# Fix ownership of data/config directories that may be owned by root
# when Railway (or other platforms) mounts persistent volumes.
if [ -d /data ]; then
  chown -R node:node /data 2>/dev/null || true
fi

# Drop to non-root user and exec the CMD
exec runuser -u node -- "$@"
