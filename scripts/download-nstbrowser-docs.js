#!/usr/bin/env node

/**
 * Download NSTBrowser API documentation from apidocs.nstbrowser.io
 * 
 * This script downloads all API documentation pages and saves them as Markdown files
 * organized by category in .kiro/docs/nstbrowser-api/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base URL for API documentation
const BASE_URL = 'https://apidocs.nstbrowser.io';

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', '.kiro', 'docs', 'nstbrowser-api');

// API endpoints to download (from api-llm.txt)
const API_ENDPOINTS = [
  // Introduction
  { url: '/doc-922484.md', category: 'intro', name: 'introduction.md' },
  
  // Browsers API
  { url: '/api-15554899.md', category: 'browsers', name: 'start-browser.md' },
  { url: '/api-15554897.md', category: 'browsers', name: 'start-browsers.md' },
  { url: '/api-15554898.md', category: 'browsers', name: 'start-once-browser.md' },
  { url: '/api-15554900.md', category: 'browsers', name: 'stop-browser.md' },
  { url: '/api-15554896.md', category: 'browsers', name: 'stop-browsers.md' },
  { url: '/api-15554895.md', category: 'browsers', name: 'get-browsers.md' },
  { url: '/api-15554902.md', category: 'browsers', name: 'get-browser-pages.md' },
  { url: '/api-15554901.md', category: 'browsers', name: 'get-browser-debugger.md' },
  
  // Profiles API
  { url: '/api-15554904.md', category: 'profiles', name: 'create-profile.md' },
  { url: '/api-15554905.md', category: 'profiles', name: 'delete-profiles.md' },
  { url: '/api-15554906.md', category: 'profiles', name: 'delete-profile.md' },
  { url: '/api-15554903.md', category: 'profiles', name: 'get-profiles.md' },
  { url: '/api-19974738.md', category: 'profiles', name: 'get-profiles-by-cursor.md' },
  
  // Profile Groups API
  { url: '/api-15645168.md', category: 'profiles/groups', name: 'get-all-profile-groups.md' },
  { url: '/api-15645166.md', category: 'profiles/groups', name: 'change-profile-group.md' },
  { url: '/api-15645167.md', category: 'profiles/groups', name: 'batch-change-profile-group.md' },
  
  // Profile Proxy API
  { url: '/api-15554907.md', category: 'profiles/proxy', name: 'update-profile-proxy.md' },
  { url: '/api-15554909.md', category: 'profiles/proxy', name: 'batch-update-proxy.md' },
  { url: '/api-15554908.md', category: 'profiles/proxy', name: 'reset-profile-proxy.md' },
  { url: '/api-15554910.md', category: 'profiles/proxy', name: 'batch-reset-profile-proxy.md' },
  
  // Profile Tags API
  { url: '/api-15554912.md', category: 'profiles/tags', name: 'create-profile-tags.md' },
  { url: '/api-15554916.md', category: 'profiles/tags', name: 'batch-create-profile-tags.md' },
  { url: '/api-15554911.md', category: 'profiles/tags', name: 'update-profile-tags.md' },
  { url: '/api-15554915.md', category: 'profiles/tags', name: 'batch-update-profile-tags.md' },
  { url: '/api-15554913.md', category: 'profiles/tags', name: 'clear-profile-tags.md' },
  { url: '/api-15554917.md', category: 'profiles/tags', name: 'batch-clear-profile-tags.md' },
  { url: '/api-15554914.md', category: 'profiles/tags', name: 'get-profile-tags.md' },
  
  // Locals API
  { url: '/api-15554918.md', category: 'locals', name: 'clear-profile-cache.md' },
  { url: '/api-15554919.md', category: 'locals', name: 'clear-profile-cookies.md' },
  
  // CDP Endpoints API
  { url: '/api-15554920.md', category: 'cdp-endpoints', name: 'connect-browser.md' },
  { url: '/api-15554921.md', category: 'cdp-endpoints', name: 'connect-once-browser.md' },
];

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Download a single API documentation page
 */
async function downloadDoc(endpoint) {
  const url = `${BASE_URL}${endpoint.url}`;
  const categoryDir = path.join(OUTPUT_DIR, endpoint.category);
  const outputPath = path.join(categoryDir, endpoint.name);
  
  console.log(`Downloading: ${url}`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`  ✗ Failed to download ${url}: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const content = await response.text();
    
    // Ensure category directory exists
    ensureDir(categoryDir);
    
    // Save to file
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`  ✓ Saved to ${path.relative(process.cwd(), outputPath)}`);
    
    return true;
  } catch (error) {
    console.error(`  ✗ Error downloading ${url}:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('NSTBrowser API Documentation Downloader');
  console.log('========================================\n');
  
  // Ensure output directory exists
  ensureDir(OUTPUT_DIR);
  
  let successCount = 0;
  let failCount = 0;
  
  // Download all endpoints
  for (const endpoint of API_ENDPOINTS) {
    const success = await downloadDoc(endpoint);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Add a small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n========================================');
  console.log(`Download complete: ${successCount} succeeded, ${failCount} failed`);
  console.log(`Documentation saved to: ${path.relative(process.cwd(), OUTPUT_DIR)}`);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
