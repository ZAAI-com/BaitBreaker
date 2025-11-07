# GitHub Actions Workflows

This directory contains automated workflows for the BaitBreaker Chrome extension.

## 📁 Workflow Files

### [`ci.yml`](./workflows/ci.yml)
**Continuous Integration** - Runs on every push and PR

- ✅ Installs dependencies
- ✅ Runs tests with coverage
- ✅ Builds the extension
- ✅ Validates build artifacts
- ✅ Checks version consistency
- ✅ Uploads build artifacts

**Triggers:**
- Push to `main`, `develop`, or `cursor/**` branches
- Pull requests to `main` or `develop`

### [`publish.yml`](./workflows/publish.yml)
**Publish to Chrome Web Store** - Automated publishing

- ✅ Runs all CI checks
- ✅ Creates production ZIP file
- ✅ Uploads to Chrome Web Store
- ✅ Submits for review
- ✅ Creates GitHub Release

**Triggers:**
- Push of version tags (e.g., `1.0.0`)
- Manual workflow dispatch from Actions tab

## 🚀 Quick Start Guides

### For Quick Setup
→ [**QUICKSTART.md**](./QUICKSTART.md) - Get publishing in 10 minutes

### For Detailed Information
→ [**PUBLISHING_GUIDE.md**](./PUBLISHING_GUIDE.md) - Complete setup guide

## 🛠️ Helper Scripts

### [`scripts/bump-version.sh`](../scripts/bump-version.sh)
Automated version management script

```bash
# Bump patch version (1.0.0 → 1.0.1)
./scripts/bump-version.sh patch

# Bump minor version (1.0.0 → 1.1.0)
./scripts/bump-version.sh minor

# Bump major version (1.0.0 → 2.0.0)
./scripts/bump-version.sh major

# Set specific version
./scripts/bump-version.sh 1.5.2
```

**What it does:**
- Updates `package.json` version
- Updates `manifest.json` version
- Updates `package-lock.json`
- Verifies version consistency
- Provides git commands for tagging

## 📊 Workflow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Developer                             │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ├─── Push/PR ────────────────────────────┐
                  │                                         │
                  │                                         ▼
                  │                              ┌──────────────────┐
                  │                              │   CI Workflow    │
                  │                              ├──────────────────┤
                  │                              │ • Test           │
                  │                              │ • Build          │
                  │                              │ • Validate       │
                  │                              │ • Check versions │
                  │                              └──────────────────┘
                  │
                  └─── Push Tag (*.*.*) ─────────────────┐
                                                          │
                                                          ▼
                                         ┌────────────────────────────┐
                                         │   Publish Workflow         │
                                         ├────────────────────────────┤
                                         │ 1. Run CI checks           │
                                         │ 2. Build production ZIP    │
                                         │ 3. Upload to CWS           │
                                         │ 4. Submit for review       │
                                         │ 5. Create GitHub Release   │
                                         └────────────────────────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────────┐
                        │                                 │                             │
                        ▼                                 ▼                             ▼
              ┌──────────────────┐           ┌──────────────────────┐       ┌──────────────────┐
              │ Chrome Web Store │           │   GitHub Release     │       │   Build Artifact │
              │   (Published)    │           │   (with ZIP file)    │       │   (archived)     │
              └──────────────────┘           └──────────────────────┘       └──────────────────┘
```

## 🔒 Required GitHub Secrets

These secrets must be configured in: `Settings → Secrets → Actions`

| Secret | Description | Required For |
|--------|-------------|--------------|
| `CHROME_EXTENSION_ID` | Your extension ID from Chrome Web Store | Publishing |
| `CHROME_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud | Publishing |
| `CHROME_CLIENT_SECRET` | OAuth 2.0 Client Secret | Publishing |
| `CHROME_REFRESH_TOKEN` | OAuth refresh token | Publishing |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | Releases |

## 📈 Workflow Status Badges

Add these to your main README.md:

```markdown
![CI](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/CI%20-%20Build%20and%20Test/badge.svg)
![Publish](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/Publish%20to%20Chrome%20Web%20Store/badge.svg)
```

## 🔄 Publishing Workflow

### Standard Release Process

```bash
# 1. Ensure you're on main branch and up to date
git checkout main
git pull

# 2. Bump version using helper script
./scripts/bump-version.sh patch  # or minor/major

# 3. Test locally
npm test
npm run build

# 4. Commit and push version bump
git add package*.json manifest.json
git commit -m "Bump version to X.Y.Z"
git push

# 5. Create and push tag (triggers publish workflow)
git tag X.Y.Z
git push origin X.Y.Z
```

### Manual Publishing (Alternative)

1. Go to **Actions** tab
2. Select "Publish to Chrome Web Store"
3. Click "Run workflow"
4. Select branch and options
5. Click "Run workflow" button

## 🎯 Best Practices

### Version Management
- ✅ Use semantic versioning (MAJOR.MINOR.PATCH)
- ✅ Always bump version before tagging
- ✅ Keep package.json and manifest.json versions in sync
- ✅ Test thoroughly before tagging

### Git Workflow
- ✅ Create feature branches for development
- ✅ PR to `develop` or `main` for review
- ✅ Only tag from `main` branch
- ✅ Use meaningful commit messages

### Testing
- ✅ Run tests locally before pushing
- ✅ Wait for CI to pass before merging PRs
- ✅ Monitor workflow logs for any warnings
- ✅ Test the built extension manually

### Security
- ✅ Never commit secrets or tokens
- ✅ Rotate refresh tokens periodically
- ✅ Use branch protection rules
- ✅ Require PR reviews for main branch

## 🐛 Troubleshooting

### CI Workflow Fails

**Tests fail:**
```bash
npm test -- --verbose
npm run test:coverage
```

**Build fails:**
```bash
npm run build
# Check dist/ directory contents
ls -la dist/
```

**Version mismatch:**
```bash
# Use the helper script to fix
./scripts/bump-version.sh $(node -p "require('./package.json').version")
```

### Publish Workflow Fails

**Authentication errors:**
- Regenerate refresh token
- Verify all secrets are correctly set
- Check Chrome Web Store API is enabled

**Upload rejected:**
- Ensure extension listing is complete
- Verify manifest.json has all required fields
- Check for policy violations

**Tag already exists:**
```bash
# Delete local tag
git tag -d 1.0.0

# Delete remote tag
git push --delete origin 1.0.0

# Create new tag
git tag 1.0.0
git push origin 1.0.0
```

## 📚 Additional Resources

- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/api_index/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [chrome-extension-upload Action](https://github.com/mnao305/chrome-extension-upload)

## 🆘 Support

If you encounter issues:

1. Check workflow logs in GitHub Actions tab
2. Review [PUBLISHING_GUIDE.md](./PUBLISHING_GUIDE.md)
3. Verify all secrets are correctly configured
4. Test the build locally: `npm run build`
5. Check Chrome Web Store Developer Dashboard for errors

## 🔄 Maintenance

### Regular Tasks

- **Monthly:** Review and test workflows
- **Quarterly:** Rotate OAuth refresh tokens
- **As needed:** Update workflow dependencies
- **Before major releases:** Test publish workflow in draft mode

### Updating Workflow Dependencies

```yaml
# Keep these updated in workflow files:
- uses: actions/checkout@v4          # Check for latest
- uses: actions/setup-node@v4        # Check for latest
- uses: mnao305/chrome-extension-upload@v5.0.0  # Check for latest
```

---

**Need help?** Start with [QUICKSTART.md](./QUICKSTART.md) or see [PUBLISHING_GUIDE.md](./PUBLISHING_GUIDE.md)
