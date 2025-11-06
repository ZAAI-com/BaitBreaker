# Publishing to Chrome Web Store with GitHub Actions

This guide explains how to set up automated publishing of BaitBreaker to the Chrome Web Store using GitHub Actions.

## Prerequisites

1. **Chrome Web Store Developer Account**
   - Sign up at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay the one-time $5 registration fee

2. **Google Cloud Project with Chrome Web Store API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Chrome Web Store API:
     - Navigate to "APIs & Services" > "Library"
     - Search for "Chrome Web Store API"
     - Click "Enable"

3. **OAuth 2.0 Credentials**
   - In Google Cloud Console, go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application" as the application type
   - Add authorized redirect URIs:
     - `https://developers.chrome.com/webstore/docs/upload-api`
   - Save the **Client ID** and **Client Secret**

4. **Refresh Token**
   - Install the Chrome extension [Chrome Web Store API OAuth Helper](https://chrome.google.com/webstore/detail/chrome-web-store-api-oauth/occlcibmobfdnmgdkjplmbhgcohallkc)
   - Open the extension and enter your Client ID and Client Secret
   - Click "Get Refresh Token"
   - Copy the generated **Refresh Token**

5. **Extension ID**
   - Upload your extension manually to Chrome Web Store once (or use the ID from the developer dashboard)
   - The Extension ID is found in the Chrome Web Store Developer Dashboard URL or in `chrome://extensions/` when loaded unpacked

## Setup GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** and add:

   - `CHROME_WEB_STORE_CLIENT_ID` - Your OAuth Client ID
   - `CHROME_WEB_STORE_CLIENT_SECRET` - Your OAuth Client Secret
   - `CHROME_WEB_STORE_REFRESH_TOKEN` - Your Refresh Token
   - `CHROME_WEB_STORE_EXTENSION_ID` - Your Extension ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

## Publishing Workflow

### Automatic Publishing (Recommended)

The workflow automatically publishes when you push a version tag:

```bash
# Update version in package.json and manifest.json first
npm version patch  # or minor, or major

# Push the tag
git push origin --tags
```

Or manually create and push a tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

### Manual Publishing

1. Go to **Actions** tab in your GitHub repository
2. Select **Publish to Chrome Web Store** workflow
3. Click **Run workflow**
4. Enter the version tag (e.g., `v1.0.1`)
5. Click **Run workflow**

## Workflow Features

- ✅ **Automated Testing**: Runs tests before building
- ✅ **Production Build**: Creates optimized production build
- ✅ **Package Creation**: Automatically creates ZIP file
- ✅ **Chrome Web Store Upload**: Publishes to Chrome Web Store
- ✅ **GitHub Release**: Creates a release with the extension ZIP file

## Version Management

Remember to update versions in both files before publishing:

1. **`package.json`** - Update the `version` field
2. **`manifest.json`** - Update the `version` field

The workflow will:
- Build the extension
- Create a ZIP package
- Upload to Chrome Web Store
- Create a GitHub release (if triggered by tag)

## Troubleshooting

### Authentication Errors

If you see authentication errors:
- Verify all secrets are correctly set in GitHub
- Ensure the Refresh Token hasn't expired (regenerate if needed)
- Check that the Chrome Web Store API is enabled in Google Cloud Console

### Extension ID Not Found

- Make sure you've uploaded the extension at least once manually
- Or create a draft in Chrome Web Store Developer Dashboard first
- The Extension ID is in the URL: `https://chrome.google.com/webstore/devconsole/edit/EXTENSION_ID`

### Build Failures

- Check that all dependencies are in `package.json`
- Ensure `npm ci` completes successfully
- Verify the build output directory `dist/` contains all required files

## Alternative: Manual Upload Script

You can also run the upload script locally:

```bash
# Build the extension first
npm run build

# Create ZIP package
cd dist
zip -r ../baitbreaker-extension.zip .
cd ..

# Upload using the script
node scripts/upload-to-chrome-store.js \
  YOUR_CLIENT_ID \
  YOUR_CLIENT_SECRET \
  YOUR_REFRESH_TOKEN \
  YOUR_EXTENSION_ID \
  baitbreaker-extension.zip \
  true
```

The script accepts 6 arguments:
1. Client ID
2. Client Secret
3. Refresh Token
4. Extension ID
5. Path to ZIP file
6. Publish flag (`true` to publish immediately, `false` to upload as draft)

## References

- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/api/)
- [Chrome Web Store Upload API](https://developer.chrome.com/docs/webstore/using_webstore_api/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
