# 🚀 Quick Start: Publishing to Chrome Web Store

This is a condensed guide to get you publishing quickly. For detailed information, see [PUBLISHING_GUIDE.md](./PUBLISHING_GUIDE.md).

## Prerequisites Checklist

- [ ] Chrome Web Store Developer Account ($5)
- [ ] Extension listing created in Chrome Web Store
- [ ] Google Cloud project with Chrome Web Store API enabled
- [ ] OAuth 2.0 credentials created (Desktop app)
- [ ] Refresh token generated
- [ ] All secrets added to GitHub

## 1️⃣ Get Your Credentials (5 minutes)

### Chrome Extension ID
```
Go to: https://chrome.google.com/webstore/devconsole
Copy from URL: /devconsole/.../YOUR_EXTENSION_ID
```

### OAuth Credentials
```
1. https://console.cloud.google.com/
2. APIs & Services → Credentials
3. Create OAuth client ID → Desktop app
4. Save Client ID and Client Secret
```

### Refresh Token
```bash
# Visit this URL (replace YOUR_CLIENT_ID):
https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob

# After auth, use the code to get refresh token:
curl "https://accounts.google.com/o/oauth2/token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTH_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```

## 2️⃣ Add GitHub Secrets (2 minutes)

Go to: `Your Repo → Settings → Secrets → Actions → New repository secret`

Add these 4 secrets:
- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

## 3️⃣ Publish Your Extension (1 minute)

### Option A: Automated (Recommended)
```bash
# Use the helper script
./scripts/bump-version.sh patch  # or minor, or major

# Review and test
npm test

# Commit and tag
git add package*.json manifest.json
git commit -m "Bump version to X.Y.Z"
git push
git tag X.Y.Z
git push origin X.Y.Z
```

### Option B: Manual
```bash
# Update versions manually in:
# - package.json
# - manifest.json

npm install  # Updates package-lock.json
npm test
git add package*.json manifest.json
git commit -m "Bump version to X.Y.Z"
git push
git tag X.Y.Z
git push origin X.Y.Z
```

## ✅ That's It!

GitHub Actions will automatically:
- Run tests
- Build the extension
- Create a ZIP file
- Upload to Chrome Web Store
- Submit for review
- Create a GitHub Release

## 📊 Monitor Progress

Watch the workflow: `Actions → Publish to Chrome Web Store`

## 🐛 Common Issues

**Tests fail?**
```bash
npm test -- --verbose
```

**Upload fails?**
- Check secrets are correct
- Verify extension ID exists
- Ensure Chrome Web Store listing is complete

**Version mismatch?**
- Run: `./scripts/bump-version.sh` to sync versions

## 💡 Pro Tips

1. **Test locally first:** `npm run build` and test in Chrome
2. **Use semantic versioning:** major.minor.patch
3. **Check workflow logs:** Always review after publishing
4. **Draft mode:** Set `publish: false` in workflow for testing

---

Need more details? See [PUBLISHING_GUIDE.md](./PUBLISHING_GUIDE.md)
