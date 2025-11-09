#!/bin/bash

# BaitBreaker Version Bump Script
# This script updates the version in both package.json and manifest.json

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo -e "${BLUE}Usage:${NC}"
    echo "  $0 <version_type>"
    echo ""
    echo -e "${BLUE}Version Types:${NC}"
    echo "  major    - Bump major version (1.0.0 -> 2.0.0)"
    echo "  minor    - Bump minor version (1.0.0 -> 1.1.0)"
    echo "  patch    - Bump patch version (1.0.0 -> 1.0.1)"
    echo "  X.Y.Z    - Set specific version (e.g., 1.2.3)"
    echo ""
    echo -e "${BLUE}Examples:${NC}"
    echo "  $0 patch      # Bump patch version"
    echo "  $0 minor      # Bump minor version"
    echo "  $0 1.5.0      # Set specific version"
    exit 1
}

update_json_version() {
    local file="$1"
    local backup="${file}.bak"
    local tmp="${file}.tmp"

    cp "$file" "$backup"

    if command -v jq &> /dev/null; then
        if ! jq ".version = \"$NEW_VERSION\"" "$file" > "$tmp"; then
            echo -e "${RED}Error: Failed to update $file with jq${NC}"
            mv "$backup" "$file"
            rm -f "$tmp"
            exit 1
        fi
    else
        if ! NEW_VERSION="$NEW_VERSION" node - "$backup" <<'NODE' > "$tmp"; then
const fs = require('fs');
const file = process.argv[1];
const version = process.env.NEW_VERSION;
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
data.version = version;
process.stdout.write(JSON.stringify(data, null, 2) + '\n');
NODE
            echo -e "${RED}Error: Failed to update $file with Node fallback${NC}"
            mv "$backup" "$file"
            rm -f "$tmp"
            exit 1
        fi
    fi

    mv "$tmp" "$file"
    rm -f "$backup"
}

# Check if version argument is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No version type specified${NC}"
    usage
fi

VERSION_TYPE="$1"

# Helpful hint if script lacks execute permissions
if [ ! -x "$0" ]; then
    printf "%b" "${YELLOW}Note: This script may require execute permissions. If you encounter 'Permission denied', run: chmod +x $0${NC}\n"
fi

# Ensure script is run from repo root
if [ ! -f "package.json" ] || [ ! -f "manifest.json" ]; then
    echo -e "${RED}Error: package.json or manifest.json not found${NC}"
    echo "Please run this script from the repository root directory"
    exit 1
fi

# Check for required commands
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js to use this script"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    echo "Please install npm to use this script"
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || true)
if [ -z "$CURRENT_VERSION" ]; then
    echo -e "${RED}Error: Unable to read current version from package.json${NC}"
    exit 1
fi

echo -e "${BLUE}Current version:${NC} $CURRENT_VERSION"

IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]:-}"
MINOR="${VERSION_PARTS[1]:-}"
PATCH_RAW="${VERSION_PARTS[2]:-}"
PATCH="${PATCH_RAW%%[^0-9]*}"

if [[ -z "$MAJOR" || -z "$MINOR" || -z "$PATCH" ]]; then
    echo -e "${RED}Error: Current version '$CURRENT_VERSION' is not a valid semantic version${NC}"
    exit 1
fi

if ! [[ "$MAJOR" =~ ^[0-9]+$ ]] || ! [[ "$MINOR" =~ ^[0-9]+$ ]] || ! [[ "$PATCH" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Current version '$CURRENT_VERSION' is not a valid semantic version${NC}"
    exit 1
fi

if [[ "$PATCH_RAW" != "$PATCH" ]]; then
    echo -e "${RED}Error: Current version '$CURRENT_VERSION' contains unsupported pre-release or metadata${NC}"
    exit 1
fi

CURRENT_MAJOR=$MAJOR
CURRENT_MINOR=$MINOR
CURRENT_PATCH=$PATCH

# Calculate new version
if [[ $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NEW_VERSION=$VERSION_TYPE
elif [[ $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+- ]]; then
    echo -e "${RED}Error: Pre-release versions (e.g., 1.0.0-beta) are not supported${NC}"
    echo "Chrome extensions require standard semantic versioning (MAJOR.MINOR.PATCH)"
    exit 1
elif [[ $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+\+ ]]; then
    echo -e "${RED}Error: Build metadata versions (e.g., 1.0.0+build.123) are not supported${NC}"
    echo "Chrome extensions require standard semantic versioning (MAJOR.MINOR.PATCH)"
    exit 1
else
    case "$VERSION_TYPE" in
        major)
            CURRENT_MAJOR=$((CURRENT_MAJOR + 1))
            CURRENT_MINOR=0
            CURRENT_PATCH=0
            ;;
        minor)
            CURRENT_MINOR=$((CURRENT_MINOR + 1))
            CURRENT_PATCH=0
            ;;
        patch)
            CURRENT_PATCH=$((CURRENT_PATCH + 1))
            ;;
        *)
            echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'${NC}"
            usage
            ;;
    esac
    NEW_VERSION="${CURRENT_MAJOR}.${CURRENT_MINOR}.${CURRENT_PATCH}"
fi

echo -e "${GREEN}New version:${NC} $NEW_VERSION"

printf "%b" "${YELLOW}Continue with version bump? [y/N]: ${NC}"
read -n 1 -r || true
echo
if [[ ! ${REPLY:-} =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted${NC}"
    exit 1
fi

# Update package.json
echo -e "${BLUE}Updating package.json...${NC}"
update_json_version "package.json"

# Update manifest.json
echo -e "${BLUE}Updating manifest.json...${NC}"
update_json_version "manifest.json"

# Update package-lock.json
echo -e "${BLUE}Updating package-lock.json...${NC}"
if ! npm install --package-lock-only; then
    echo -e "${RED}Error: Failed to update package-lock.json${NC}"
    echo "Please check your package.json for errors"
    exit 1
fi

# Verify versions match
PACKAGE_VERSION=$(node -p "require('./package.json').version")
MANIFEST_VERSION=$(node -p "require('./manifest.json').version")

if [ "$PACKAGE_VERSION" != "$NEW_VERSION" ] || [ "$MANIFEST_VERSION" != "$NEW_VERSION" ]; then
    echo -e "${RED}Error: Version update failed!${NC}"
    echo "Package: $PACKAGE_VERSION"
    echo "Manifest: $MANIFEST_VERSION"
    echo "Expected: $NEW_VERSION"
    exit 1
fi

echo -e "${GREEN}✅ Version successfully updated to $NEW_VERSION${NC}"
echo ""
echo -e "${BLUE}Files updated:${NC}"
echo "  - package.json"
echo "  - package-lock.json"
echo "  - manifest.json"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review the changes: git diff"
echo "  2. Test the extension: npm test"
echo "  3. Commit: git add package*.json manifest.json"
echo "  4. Commit: git commit -m \"Bump version to $NEW_VERSION\""
echo "  5. Push: git push"
echo "  6. Tag: git tag $NEW_VERSION"
echo "  7. Push tag: git push origin $NEW_VERSION"
echo ""
echo -e "${GREEN}Or run this shortcut:${NC}"
echo "  git add package*.json manifest.json && \\\"
echo "  git commit -m \"Bump version to $NEW_VERSION\" && \\\"
echo "  git push && \\\"
echo "  git tag $NEW_VERSION && \\\"
echo "  git push origin $NEW_VERSION"
