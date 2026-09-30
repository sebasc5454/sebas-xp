#!/bin/sh
# Runs the unit tests with the JavaScript engine built into macOS (no installs needed).
# Usage (from the project folder):  sh tests/run.sh
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
cd "$(dirname "$0")/.." || exit 1
if command -v node >/dev/null 2>&1; then exec node tests/run.js; fi
exec "$JSC" -m tests/run.js
