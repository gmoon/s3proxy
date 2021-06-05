#!/bin/sh
set -e
set -u

# Required environment variables
( : $BUCKET )
( : $PORT )

exec "$@"
