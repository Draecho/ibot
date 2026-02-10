#!/bin/sh
# Fix ownership of the /data volume mount so the non-root 'node' user can write.
# Railway volumes are mounted as root; this runs as root before exec drops to 'node'.
if [ -d /data ] && [ "$(id -u)" = "0" ]; then
  chown -R node:node /data
  exec gosu node "$@"
else
  exec "$@"
fi
