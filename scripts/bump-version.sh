#!/bin/bash

# BaitBreaker Version Bump Script
# This script updates the version in both package.json and manifest.json

set -e

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

# Check if version argument is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No version type specified${NC}"
    usage
fi

VERSION_TYPE=$1

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current version:${NC} $CURRENT_VERSION"

# Calculate new version
if [[ $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # Specific version provided
    NEW_VERSION=$VERSION_TYPE
else
    # Calculate version bump
    IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR="${VERSION_PARTS[0]}"
    MINOR="${VERSION_PARTS[1]}"
    PATCH="${VERSION_PARTS[2]}"

    case $VERSION_TYPE in
        major)
            MAJOR=$((MAJOR + 1))
            MINOR=0
            PATCH=0
            ;;
        minor)
            MINOR=$((MINOR + 1))
            PATCH=0
            ;;
        patch)
            PATCH=$((PATCH + 1))
            ;;
        *)
            echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'${NC}"
            usage
            ;;
    esac

    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
fi

echo -e "${GREEN}New version:${NC} $NEW_VERSION"

# Confirm with user
read -p "$(echo -e ${YELLOW}Continue with version bump? [y/N]:${NC} )" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted${NC}"
    exit 1
fi

# Update package.json
echo -e "${BLUE}Updating package.json...${NC}"
if command -v jq &> /dev/null; then
    # Use jq if available (cleaner)
    jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
else
    # Fallback to sed
    sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
    rm -f package.json.bak
fi

# Update manifest.json
echo -e "${BLUE}Updating manifest.json...${NC}"
if command -v jq &> /dev/null; then
    jq ".version = \"$NEW_VERSION\"" manifest.json > manifest.json.tmp && mv manifest.json.tmp manifest.json
else
    sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" manifest.json
    rm -f manifest.json.bak
fi

# Update package-lock.json
echo -e "${BLUE}Updating package-lock.json...${NC}"
npm install --package-lock-only

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
echo "  git add package*.json manifest.json && \\"
echo "  git commit -m \"Bump version to $NEW_VERSION\" && \\"
echo "  git push && \\"
echo "  git tag $NEW_VERSION && \\"
echo "  git push origin $NEW_VERSION"
