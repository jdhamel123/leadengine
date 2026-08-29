#!/bin/sh
set -eu
PORT_VALUE="${PORT:-3000}"
curl -fsS "http://127.0.0.1:${PORT_VALUE}/api/health"
