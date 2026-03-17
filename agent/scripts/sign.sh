#!/bin/bash
#
# Code signing script for OpenType Agent
#
# Usage:
#   ./sign.sh                    # Ad-hoc signing (for local testing)
#   ./sign.sh "Developer ID"     # Sign with specific identity
#   SIGNING_IDENTITY="Developer ID" ./sign.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="OpenTypeAgent"
APP_PATH="${1:-$AGENT_DIR/dist/$APP_NAME.app}"
SIGNING_IDENTITY="${SIGNING_IDENTITY:--}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Error: App not found at $APP_PATH${NC}"
    echo "Build the app first with: python3 setup.py py2app"
    exit 1
fi

echo "Signing: $APP_PATH"
echo "Identity: $SIGNING_IDENTITY"
echo ""

# Sign the main executable
echo "Signing main executable..."
codesign --force --options runtime --sign "$SIGNING_IDENTITY" \
    --entitlements "$AGENT_DIR/entitlements.plist" \
    "$APP_PATH/Contents/MacOS/$APP_NAME"

# Sign frameworks and libraries
echo "Signing frameworks..."
find "$APP_PATH/Contents/Frameworks" -type f -name "*.dylib" -o -name "*.so" 2>/dev/null | while read -r lib; do
    codesign --force --sign "$SIGNING_IDENTITY" "$lib" 2>/dev/null || true
done

# Deep sign the entire bundle
echo "Deep signing bundle..."
codesign --force --options runtime --deep --sign "$SIGNING_IDENTITY" \
    --entitlements "$AGENT_DIR/entitlements.plist" \
    "$APP_PATH"

# Verify
echo ""
echo "Verifying signature..."
if codesign --verify --verbose "$APP_PATH" 2>&1; then
    echo -e "${GREEN}✓ Signature verified${NC}"
else
    echo -e "${YELLOW}⚠ Signature verification had warnings${NC}"
fi

echo ""
echo "Signature details:"
codesign -dvv "$APP_PATH" 2>&1 | head -20
