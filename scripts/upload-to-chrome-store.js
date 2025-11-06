#!/usr/bin/env node

/**
 * Script to upload Chrome extension to Chrome Web Store
 * Uses Chrome Web Store API v1
 */

const fs = require('fs');
const https = require('https');
const querystring = require('querystring');

const [
  clientId,
  clientSecret,
  refreshToken,
  extensionId,
  zipPath,
  publish = 'false'
] = process.argv.slice(2);

if (!clientId || !clientSecret || !refreshToken || !extensionId || !zipPath) {
  console.error('Usage: node upload-to-chrome-store.js <client-id> <client-secret> <refresh-token> <extension-id> <zip-path> [publish=true|false]');
  process.exit(1);
}

if (!fs.existsSync(zipPath)) {
  console.error(`Error: ZIP file not found: ${zipPath}`);
  process.exit(1);
}

const shouldPublish = publish === 'true' || publish === '1';

// Step 1: Get access token
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to get access token: ${res.statusCode} - ${data}`));
          return;
        }
        const response = JSON.parse(data);
        resolve(response.access_token);
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Step 2: Upload ZIP file
function uploadExtension(accessToken) {
  return new Promise((resolve, reject) => {
    const zipData = fs.readFileSync(zipPath);
    
    const options = {
      hostname: 'www.googleapis.com',
      path: `/upload/chromewebstore/v1.1/items/${extensionId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Type': 'application/zip',
        'Content-Length': zipData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to upload extension: ${res.statusCode} - ${data}`));
          return;
        }
        const response = JSON.parse(data);
        console.log('✓ Extension uploaded successfully');
        console.log(`  Upload ID: ${response.id}`);
        resolve(accessToken);
      });
    });

    req.on('error', reject);
    req.write(zipData);
    req.end();
  });
}

// Step 3: Publish extension (if requested)
function publishExtension(accessToken) {
  if (!shouldPublish) {
    console.log('ℹ Skipping publish (set publish=true to publish)');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path: `/chromewebstore/v1.1/items/${extensionId}/publish`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Length': 0
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to publish extension: ${res.statusCode} - ${data}`));
          return;
        }
        const response = JSON.parse(data);
        console.log('✓ Extension published successfully');
        if (response.status && response.status.length > 0) {
          console.log(`  Status: ${response.status.join(', ')}`);
        }
        resolve();
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Main execution
async function main() {
  try {
    console.log('🔐 Getting access token...');
    const accessToken = await getAccessToken();
    
    console.log('📦 Uploading extension...');
    await uploadExtension(accessToken);
    
    console.log('🚀 Publishing extension...');
    await publishExtension(accessToken);
    
    console.log('\n✅ Success! Extension uploaded and published to Chrome Web Store.');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
