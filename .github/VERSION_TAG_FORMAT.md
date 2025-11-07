# Version Tag Format

## Format: Semantic Versioning WITHOUT "v" Prefix

This project uses **semantic versioning without the "v" prefix** for git tags.

### ✅ Correct Format

```bash
git tag 1.0.0
git tag 1.2.3
git tag 2.0.0
```

### ❌ Incorrect Format

```bash
git tag v1.0.0   # Don't use "v" prefix
git tag v1.2.3   # Don't use "v" prefix
git tag v2.0.0   # Don't use "v" prefix
```

## Why This Format?

- **Consistency:** Version numbers in `package.json` and `manifest.json` don't have "v" prefix
- **Simplicity:** Direct match between file versions and git tags (1.0.0 = 1.0.0)
- **Automation:** Easier to parse and use in scripts without string manipulation

## GitHub Actions Trigger

The publish workflow triggers on tags matching the pattern: `*.*.*`

```yaml
on:
  push:
    tags:
      - '*.*.*'  # Matches: 1.0.0, 1.2.3, 2.0.0, etc.
```

## Usage Examples

### Using the Helper Script (Recommended)

The `bump-version.sh` script automatically provides the correct format:

```bash
./scripts/bump-version.sh patch
# Output includes:
#   git tag 1.0.1
#   git push origin 1.0.1
```

### Manual Tagging

```bash
# Update versions in package.json and manifest.json
# Then:
git add package*.json manifest.json
git commit -m "Bump version to 1.2.0"
git push
git tag 1.2.0
git push origin 1.2.0
```

## Version Format Rules

- **Format:** MAJOR.MINOR.PATCH (e.g., 1.2.3)
- **MAJOR:** Breaking changes (1.0.0 → 2.0.0)
- **MINOR:** New features, backwards compatible (1.0.0 → 1.1.0)
- **PATCH:** Bug fixes, backwards compatible (1.0.0 → 1.0.1)

## Deleting Tags (If Needed)

```bash
# Delete local tag
git tag -d 1.0.0

# Delete remote tag
git push --delete origin 1.0.0

# Create new tag
git tag 1.0.0
git push origin 1.0.0
```

## Important Notes

1. **Always sync file versions first** before creating tags
2. **Tags are immutable** - once pushed and published, they should not be changed
3. **Test before tagging** - the tag push triggers automatic publishing
4. **Use the helper script** - it ensures consistency across all files

---

For more information, see:
- [QUICKSTART.md](./QUICKSTART.md) - Quick setup guide
- [PUBLISHING_GUIDE.md](./PUBLISHING_GUIDE.md) - Complete guide
- [README.md](./README.md) - Workflow overview
