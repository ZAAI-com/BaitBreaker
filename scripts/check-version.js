#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readVersion(filePath) {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof json.version !== 'string') {
      throw new Error(`Missing version field in ${filePath}`);
    }
    return json.version;
  } catch (error) {
    console.error(`Failed to read version from ${filePath}:`, error.message);
    process.exit(1);
  }
}

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const manifestPath = path.join(root, 'manifest.json');

const packageVersion = readVersion(packagePath);
const manifestVersion = readVersion(manifestPath);

if (packageVersion !== manifestVersion) {
  console.error('Version mismatch detected!', {
    package: packageVersion,
    manifest: manifestVersion,
  });
  process.exit(1);
}

console.log(`Versions match: ${packageVersion}`);
