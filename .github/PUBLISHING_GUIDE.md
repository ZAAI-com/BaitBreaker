# Chrome Web Store Publishing Guide

This guide explains how to publish the BaitBreaker extension to the Chrome Web Store using GitHub Actions.

## 🚀 Quick Start

1. **Set up Chrome Web Store API credentials** (see below)
2. **Add secrets to GitHub repository**
3. **Create a version tag and push**
4. **GitHub Actions automatically builds and publishes**

---

## 📋 Prerequisites

Before you can use the automated publishing workflow, you need to:

1. Have a [Chrome Web Store Developer Account](https://chrome.google.com/webstore/devconsole) ($5 one-time fee)
2. Create your extension listing (or have an existing one)
3. Obtain API credentials from Google Cloud Console

---

## 🔑 Step 1: Get Chrome Web Store API Credentials

### A. Enable the Chrome Web Store API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Chrome Web Store API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Chrome Web Store API"
   - Click "Enable"

### B. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Desktop app" as the application type
4. Name it (e.g., "BaitBreaker GitHub Actions")
5. Click "Create"
6. **Save the Client ID and Client Secret** - you'll need these!

### C. Get Your Extension ID

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Find your extension
3. Click on it and copy the **Item ID** from the URL
   - URL format: `https://chrome.google.com/webstore/devconsole/.../EXTENSION_ID_HERE`

### D. Generate a Refresh Token

You need to generate a refresh token that GitHub Actions can use. Run this script locally:

```bash
# Install a helper tool (one-time)
npm install -g chrome-webstore-upload-cli

# Or use curl to get the token manually:
```

**Manual method using curl:**

```bash
# Step 1: Get authorization code
# Replace YOUR_CLIENT_ID with your actual client ID
# Visit this URL in your browser:
https://accounts.google.com/o/oauth2/v2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob

# Step 2: After authorizing, copy the authorization code from the page

# Step 3: Exchange the authorization code for a refresh token
curl "https://oauth2.googleapis.com/token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"

# The response will contain your refresh_token - save it!
```

---

## 🔒 Step 2: Add Secrets to GitHub Repository

Go to your GitHub repository settings:

1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add each of these:

| Secret Name | Description | Where to Find |
|-------------|-------------|---------------|
| `CHROME_EXTENSION_ID` | Your extension's ID | Chrome Web Store Dashboard URL |
| `CHROME_CLIENT_ID` | OAuth 2.0 Client ID | Google Cloud Console → Credentials |
| `CHROME_CLIENT_SECRET` | OAuth 2.0 Client Secret | Google Cloud Console → Credentials |
| `CHROME_REFRESH_TOKEN` | OAuth refresh token | Generated using the curl commands above |

---

## 📦 Step 3: Publishing Your Extension

### Automated Publishing (Recommended)

### Option A: Tag-based Publishing

```bash
# Update version in package.json and manifest.json first!
# Then create and push a version tag:
git tag 1.0.0
git push origin 1.0.0
```

This automatically:
- ✅ Runs tests
- ✅ Builds the extension
- ✅ Creates a ZIP file
- ✅ Uploads to Chrome Web Store
- ✅ Submits for review
- ✅ Creates a GitHub Release with the ZIP

### Option B: Manual Trigger

1. Go to **Actions** tab in your GitHub repository
2. Select "Publish to Chrome Web Store" workflow
3. Click "Run workflow"
4. Choose whether to submit for review
5. Click "Run workflow"

### Manual Publishing (Backup)

If you need to publish manually:

```bash
# Build the extension
npm run build

# Create a ZIP file
cd dist
zip -r baitbreaker.zip .

# Upload baitbreaker.zip to Chrome Web Store Developer Dashboard
```

---

## 🔄 Workflow Behavior

### When a Tag is Pushed

```yaml
on:
  push:
    tags:
      - '[0-9]+.[0-9]+.[0-9]+'
```

- Triggers automatically on version tags (e.g., `1.0.0`, `2.1.3`)
- Builds, tests, and publishes
- Automatically submits for review
- Creates a GitHub Release

### Manual Workflow Dispatch

```yaml
on:
  workflow_dispatch:
    inputs:
      submit_for_review:
        description: 'Submit for review after upload'
```

- Can be triggered manually from GitHub Actions UI
- Allows you to choose whether to submit for review
- Useful for testing or uploading drafts

---

## 📝 Version Management Checklist

Before creating a new release:

- [ ] Update version in `package.json`
- [ ] Update version in `manifest.json`
- [ ] Run `npm install` to update `package-lock.json`
- [ ] Test the extension locally
- [ ] Run `npm test` to ensure all tests pass
- [ ] Commit the version changes
- [ ] Create and push a git tag

**Example:**

```bash
# 1. Update versions in package.json and manifest.json
# (Edit both files manually)

# 2. Update lock file
npm install

# 3. Test
npm test

# 4. Commit
git add package.json package-lock.json manifest.json
git commit -m "Bump version to 1.1.0"
git push

# 5. Tag and trigger workflow
git tag 1.1.0
git push origin 1.1.0
```

---

## 🐛 Troubleshooting

### "Invalid refresh token"

- Regenerate the refresh token using the curl commands
- Update the `CHROME_REFRESH_TOKEN` secret in GitHub

### "Extension ID not found"

- Double-check the extension ID in your secrets
- Ensure you've created the extension listing in Chrome Web Store first

### "Upload failed"

- Check that the manifest version matches your tag
- Ensure all required fields are filled in your Chrome Web Store listing
- Verify the ZIP contains the correct files (check the artifacts in GitHub Actions)

### "Tests failed"

- The workflow won't publish if tests fail
- Fix the failing tests and push again
- You can temporarily comment out the test step if needed (not recommended)

---

## 🎯 Best Practices

1. **Always test locally** before creating a tag
2. **Use semantic versioning** (major.minor.patch)
3. **Write meaningful commit messages** for the version bump
4. **Review the GitHub Actions logs** after each publish
5. **Keep secrets secure** - never commit them to the repository
6. **Test in draft mode first** by setting `publish: false` in the workflow

---

## 📚 Additional Resources

- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/api_index/)
- [Chrome Extension Publishing Guide](https://developer.chrome.com/docs/webstore/publish/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [chrome-extension-upload Action](https://github.com/mnao305/chrome-extension-upload)

---

## 🔐 Security Notes

- **Never commit API credentials** to your repository
- Store all sensitive data in GitHub Secrets
- Refresh tokens don't expire unless revoked
- Limit access to your GitHub repository settings
- Use branch protection rules for the main branch
- Require code review before merging version bumps
