#!/bin/bash
#
# Build script for OpenType Agent DMG
# Creates a signed DMG for distribution
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENT_DIR="$PROJECT_ROOT/agent"
BUILD_DIR="$AGENT_DIR/build"
DIST_DIR="$PROJECT_ROOT/release"

# Configuration
APP_NAME="OpenTypeAgent"
BUNDLE_ID="com.opentype.agent"
VERSION=$(grep "^VERSION" "$AGENT_DIR/OpenTypeAgent/constants.py" | cut -d'"' -f2)

# Code signing (optional - set environment variables or modify here)
# For App Store distribution: SIGNING_IDENTITY="Developer ID Application: Your Name"
# For local/ad-hoc: SIGNING_IDENTITY="-" (ad-hoc signing)
SIGNING_IDENTITY="${SIGNING_IDENTITY:--}"

# Notarization (optional - requires Apple Developer account)
NOTARIZE="${NOTARIZE:-false}"
APPLE_ID="${APPLE_ID:-}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"
APPLE_APP_PASSWORD="${APPLE_APP_PASSWORD:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Building OpenType Agent v$VERSION"
echo "=========================================="

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf "$BUILD_DIR"
rm -rf "$AGENT_DIR/dist"
mkdir -p "$BUILD_DIR"
mkdir -p "$DIST_DIR"

# Build the app with py2app
echo "Building app with py2app..."
cd "$AGENT_DIR"
python3 setup.py py2app --dist-dir "$BUILD_DIR" --bdist-base "$BUILD_DIR/build"

APP_PATH="$BUILD_DIR/$APP_NAME.app"

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Error: App bundle not found at $APP_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ App bundle created${NC}"

# Code signing
echo "Signing app bundle..."
if [ "$SIGNING_IDENTITY" != "-" ]; then
    # Deep sign the app bundle
    codesign --force --options runtime --deep --sign "$SIGNING_IDENTITY" \
        --entitlements "$AGENT_DIR/entitlements.plist" \
        "$APP_PATH"
    echo -e "${GREEN}✓ Code signed with: $SIGNING_IDENTITY${NC}"
else
    # Ad-hoc signing (no Developer ID)
    codesign --force --deep --sign "-" "$APP_PATH"
    echo -e "${YELLOW}⚠ Ad-hoc signed (no Developer ID)${NC}"
fi

# Verify signature
echo "Verifying code signature..."
codesign --verify --verbose "$APP_PATH" || true

# Create DMG
echo "Creating DMG..."
DMG_NAME="${APP_NAME}-${VERSION}.dmg"
DMG_PATH="$DIST_DIR/$DMG_NAME"
TEMP_DMG="$BUILD_DIR/temp.dmg"
VOLUME_NAME="$APP_NAME $VERSION"

# Remove old DMG
rm -f "$DMG_PATH"

# Create temporary DMG
echo "Creating temporary DMG..."
hdiutil create -srcfolder "$APP_PATH" -volname "$VOLUME_NAME" \
    -fs HFS+ -fsargs "-c c=64,a=16,e=16" -format UDRW \
    "$TEMP_DMG"

# Mount the DMG
MOUNT_POINT="/Volumes/$VOLUME_NAME"
echo "Mounting DMG..."
hdiutil attach "$TEMP_DMG" -mountpoint "$MOUNT_POINT" -nobrowse -noverify

# Add symbolic link to Applications folder
echo "Adding Applications symlink..."
ln -sf /Applications "$MOUNT_POINT/Applications"

# Add background image and DS_Store for custom layout (optional)
# mkdir -p "$MOUNT_POINT/.background"
# cp "$AGENT_DIR/resources/dmg-background.tiff" "$MOUNT_POINT/.background/"

# Set DMG window properties
osascript <<EOF
tell application "Finder"
    tell disk "$VOLUME_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {400, 100, 800, 400}
        set viewOptions to icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 128
        set position of item "$APP_NAME.app" of container window to {100, 150}
        set position of item "Applications" of container window to {300, 150}
        close
    end tell
end tell
EOF

# Unmount
hdiutil detach "$MOUNT_POINT" -force || hdiutil detach "$MOUNT_POINT" -force

# Convert to compressed read-only DMG
echo "Compressing DMG..."
hdiutil convert "$TEMP_DMG" -format UDZO -o "$DMG_PATH"

# Sign the DMG
echo "Signing DMG..."
codesign --sign "$SIGNING_IDENTITY" "$DMG_PATH" || true

echo -e "${GREEN}✓ DMG created: $DMG_PATH${NC}"

# Notarization (if enabled)
if [ "$NOTARIZE" = "true" ] && [ -n "$APPLE_ID" ]; then
    echo "Submitting for notarization..."

    # Submit
    xcrun notarytool submit "$DMG_PATH" \
        --apple-id "$APPLE_ID" \
        --team-id "$APPLE_TEAM_ID" \
        --password "$APPLE_APP_PASSWORD" \
        --wait

    # Staple the ticket
    xcrun stapler staple "$DMG_PATH"

    echo -e "${GREEN}✓ Notarization complete${NC}"
fi

# Cleanup
rm -f "$TEMP_DMG"

# Calculate checksums
echo "Generating checksums..."
cd "$DIST_DIR"
shasum -a 256 "$DMG_NAME" > "${DMG_NAME}.sha256"
md5 "$DMG_NAME" > "${DMG_NAME}.md5"

echo ""
echo "=========================================="
echo -e "${GREEN}Build complete!${NC}"
echo "Version: $VERSION"
echo "Output: $DMG_PATH"
echo "=========================================="
echo ""
echo "Checksums:"
cat "${DMG_PATH}.sha256"
