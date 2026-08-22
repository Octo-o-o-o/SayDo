#!/bin/bash
exec node "$(cd "$(dirname "$0")" && pwd)/test-migration-tools.mjs" "$@"
