#!/bin/bash
exec node "$(cd "$(dirname "$0")" && pwd)/check-hardcoded-colors.mjs" "$@"
