#!/bin/bash
exec node "$(cd "$(dirname "$0")" && pwd)/test-emoji-gate.mjs" "$@"
