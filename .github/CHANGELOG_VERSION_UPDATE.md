# Version Tag Format Update

## What Changed?

The project now uses **version tags without the "v" prefix**.

### Before (Old Format)
```bash
git tag v1.0.0
git push origin v1.0.0
```

### After (New Format)
```bash
git tag 1.0.0
git push origin 1.0.0
```

## Files Updated

### 1. **GitHub Actions Workflow** (`.github/workflows/publish.yml`)
   - **Changed:** Tag trigger pattern from `'v*.*.*'` to `'*.*.*'`
   - **Effect:** Workflow now triggers on tags like `1.0.0` instead of `v1.0.0`

### 2. **Version Bump Script** (`scripts/bump-version.sh`)
   - **Changed:** Git tag commands now suggest `git tag X.Y.Z` (without "v")
   - **Effect:** Script output provides correct tagging commands

### 3. **Documentation Files** (All `.md` files in `.github/`)
   - **Updated Files:**
     - `QUICKSTART.md`
     - `PUBLISHING_GUIDE.md`
     - `README.md`
     - `WORKFLOW_DIAGRAM.md`
     - `PUBLISHING_SETUP_SUMMARY.md`
   - **Changed:** All examples updated to use tags without "v" prefix

## Why This Change?

1. **Consistency:** Matches version format in `package.json` and `manifest.json`
2. **Simplicity:** No need to strip "v" prefix in automation
3. **Clarity:** Version number is exactly what you see in files

## Migration Guide

### If You Have Existing Tags with "v" Prefix

No action needed! Old tags continue to work. Just use the new format going forward:

```bash
# Old tags (still work)
1.0.0 ← use from now on
```

### For New Releases

Simply use the new format:

```bash
# Option 1: Use helper script (recommended)
./scripts/bump-version.sh patch

# Option 2: Manual
git tag 1.0.1
git push origin 1.0.1
```

## Testing the Change

To verify the workflow trigger works:

```bash
# 1. Make a test change
echo "# Test" >> README.md

# 2. Commit
git add README.md
git commit -m "Test version tag format"
git push

# 3. Create test tag (use a test version number)
git tag 999.0.0
git push origin 999.0.0

# 4. Check GitHub Actions
# Navigate to: Repository → Actions → "Publish to Chrome Web Store"
# You should see the workflow triggered by tag "999.0.0"

# 5. Clean up test tag
git tag -d 999.0.0
git push --delete origin 999.0.0
```

## Summary

✅ **No breaking changes** - this is purely a format update  
✅ **Scripts updated** - helper script now uses correct format  
✅ **Workflows updated** - GitHub Actions triggers on new format  
✅ **Documentation updated** - all examples show correct format  

---

**You're all set!** Just remember to use `1.0.0` format instead of `v1.0.0` going forward.

For questions, see: [VERSION_TAG_FORMAT.md](./VERSION_TAG_FORMAT.md)
