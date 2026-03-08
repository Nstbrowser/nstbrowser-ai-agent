#!/usr/bin/env node

/**
 * Analyze NSTBrowser API coverage
 * 
 * This script compares the downloaded API documentation with the implemented
 * methods in src/nstbrowser-client.ts to generate a coverage report.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const DOCS_DIR = path.join(__dirname, '..', '.kiro', 'docs', 'nstbrowser-api');
const CLIENT_FILE = path.join(__dirname, '..', 'src', 'nstbrowser-client.ts');
const OUTPUT_FILE = path.join(DOCS_DIR, 'coverage-report.md');

// API endpoints from documentation
const API_ENDPOINTS = {
  'Browsers': [
    { name: 'StartBrowser', method: 'startBrowser', endpoint: 'POST /api/v2/browsers/{profileId}' },
    { name: 'StartBrowsers', method: 'startBrowsersBatch', endpoint: 'POST /api/v2/browsers/batch' },
    { name: 'StartOnceBrowser', method: 'startOnceBrowser', endpoint: 'POST /api/v2/browsers/once' },
    { name: 'StopBrowser', method: 'stopBrowser', endpoint: 'DELETE /api/v2/browsers/{profileId}' },
    { name: 'StopBrowsers', method: 'stopAllBrowsers', endpoint: 'DELETE /api/v2/browsers/' },
    { name: 'GetBrowsers', method: 'getBrowsers', endpoint: 'GET /api/v2/browsers' },
    { name: 'GetBrowserPages', method: 'getBrowserPages', endpoint: 'GET /api/v2/browsers/{profileId}/pages' },
    { name: 'GetBrowserDebugger', method: 'getBrowserDebugger', endpoint: 'GET /api/v2/browsers/{profileId}/debugger' },
  ],
  'Profiles': [
    { name: 'CreateProfile', method: 'createProfile', endpoint: 'POST /api/v2/profiles' },
    { name: 'DeleteProfile', method: 'deleteProfile', endpoint: 'DELETE /api/v2/profiles/{profileId}' },
    { name: 'DeleteProfiles', method: 'deleteProfilesBatch', endpoint: 'DELETE /api/v2/profiles' },
    { name: 'GetProfiles', method: 'getProfiles', endpoint: 'GET /api/v2/profiles' },
    { name: 'GetProfilesByCursor', method: 'getProfilesByCursor', endpoint: 'GET /api/v2/profiles/cursor' },
  ],
  'Profile Groups': [
    { name: 'GetAllProfileGroups', method: 'getAllProfileGroups', endpoint: 'GET /api/v2/profiles/groups' },
    { name: 'ChangeProfileGroup', method: 'changeProfileGroup', endpoint: 'PUT /api/v2/profiles/{profileId}/group' },
    { name: 'BatchChangeProfileGroup', method: 'batchChangeProfileGroup', endpoint: 'PUT /api/v2/profiles/group/batch' },
  ],
  'Profile Proxy': [
    { name: 'UpdateProfileProxy', method: 'updateProfileProxy', endpoint: 'PUT /api/v2/profiles/{profileId}/proxy' },
    { name: 'BatchUpdateProxy', method: 'batchUpdateProxy', endpoint: 'PUT /api/v2/profiles/proxy/batch' },
    { name: 'ResetProfileProxy', method: 'resetProfileProxy', endpoint: 'DELETE /api/v2/profiles/{profileId}/proxy' },
    { name: 'BatchResetProfileProxy', method: 'batchResetProfileProxy', endpoint: 'POST /api/v2/profiles/proxy/batch-reset' },
  ],
  'Profile Tags': [
    { name: 'GetProfileTags', method: 'getProfileTags', endpoint: 'GET /api/v2/profiles/tags' },
    { name: 'CreateProfileTags', method: 'createProfileTags', endpoint: 'POST /api/v2/profiles/{profileId}/tags' },
    { name: 'BatchCreateProfileTags', method: 'batchCreateProfileTags', endpoint: 'POST /api/v2/profiles/tags/batch' },
    { name: 'UpdateProfileTags', method: 'updateProfileTags', endpoint: 'PUT /api/v2/profiles/{profileId}/tags' },
    { name: 'BatchUpdateProfileTags', method: 'batchUpdateProfileTags', endpoint: 'PUT /api/v2/profiles/tags/batch' },
    { name: 'ClearProfileTags', method: 'clearProfileTags', endpoint: 'DELETE /api/v2/profiles/{profileId}/tags' },
    { name: 'BatchClearProfileTags', method: 'batchClearProfileTags', endpoint: 'POST /api/v2/profiles/tags/batch-clear' },
  ],
  'Local Data': [
    { name: 'ClearProfileCache', method: 'clearProfileCache', endpoint: 'DELETE /api/v2/profiles/{profileId}/cache' },
    { name: 'ClearProfileCookies', method: 'clearProfileCookies', endpoint: 'DELETE /api/v2/profiles/{profileId}/cookies' },
  ],
  'CDP Endpoints': [
    { name: 'ConnectBrowser', method: 'connectBrowser', endpoint: 'POST /api/v2/browsers/{profileId}' },
    { name: 'ConnectOnceBrowser', method: 'connectOnceBrowser', endpoint: 'POST /api/v2/browsers/once' },
    { name: 'GetCdpUrl', method: 'getCdpUrl', endpoint: 'GET /api/v2/connect/{profileId}' },
    { name: 'GetCdpUrlOnce', method: 'getCdpUrlOnce', endpoint: 'GET /api/v2/connect' },
  ],
};

/**
 * Check if a method is implemented in the client
 */
function checkMethodImplementation(clientCode, methodName) {
  // Look for method definition
  const methodPattern = new RegExp(`async\\s+${methodName}\\s*\\(`);
  return methodPattern.test(clientCode);
}

/**
 * Generate coverage report
 */
function generateReport() {
  console.log('Analyzing API coverage...\n');
  
  // Read client code
  const clientCode = fs.readFileSync(CLIENT_FILE, 'utf8');
  
  let report = '# NSTBrowser API Coverage Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '## Summary\n\n';
  
  let totalApis = 0;
  let implementedApis = 0;
  let notImplementedApis = 0;
  
  const categoryResults = {};
  
  // Analyze each category
  for (const [category, apis] of Object.entries(API_ENDPOINTS)) {
    const results = apis.map(api => ({
      ...api,
      implemented: checkMethodImplementation(clientCode, api.method),
    }));
    
    categoryResults[category] = results;
    
    const implemented = results.filter(r => r.implemented).length;
    const total = results.length;
    
    totalApis += total;
    implementedApis += implemented;
    notImplementedApis += (total - implemented);
  }
  
  const coveragePercent = ((implementedApis / totalApis) * 100).toFixed(1);
  
  report += `- Total APIs: ${totalApis}\n`;
  report += `- Implemented: ${implementedApis}\n`;
  report += `- Not Implemented: ${notImplementedApis}\n`;
  report += `- Coverage: ${coveragePercent}%\n\n`;
  
  // Detailed breakdown by category
  report += '## Coverage by Category\n\n';
  
  for (const [category, results] of Object.entries(categoryResults)) {
    const implemented = results.filter(r => r.implemented).length;
    const total = results.length;
    const percent = ((implemented / total) * 100).toFixed(1);
    
    report += `### ${category} (${implemented}/${total} - ${percent}%)\n\n`;
    
    // Implemented APIs
    const implementedList = results.filter(r => r.implemented);
    if (implementedList.length > 0) {
      report += '#### ✓ Implemented\n\n';
      for (const api of implementedList) {
        report += `- **${api.name}** → \`${api.method}()\`\n`;
        report += `  - Endpoint: \`${api.endpoint}\`\n`;
      }
      report += '\n';
    }
    
    // Not implemented APIs
    const notImplementedList = results.filter(r => !r.implemented);
    if (notImplementedList.length > 0) {
      report += '#### ✗ Not Implemented\n\n';
      for (const api of notImplementedList) {
        report += `- **${api.name}** → \`${api.method}()\`\n`;
        report += `  - Endpoint: \`${api.endpoint}\`\n`;
      }
      report += '\n';
    }
  }
  
  // Implementation notes
  report += '## Implementation Notes\n\n';
  report += '### Method Aliases\n\n';
  report += 'The client provides convenience aliases for some methods:\n\n';
  report += '- `listProfiles()` → `getProfiles()`\n';
  report += '- `deleteProfiles()` → `deleteProfilesBatch()`\n';
  report += '- `listBrowsers()` → `getBrowsers()`\n';
  report += '- `listTags()` → `getProfileTags()`\n';
  report += '- `listGroups()` → `getAllProfileGroups()`\n\n';
  
  report += '### Additional Features\n\n';
  report += '- Profile name resolution (resolve profile by name or ID)\n';
  report += '- Automatic retry with exponential backoff\n';
  report += '- Debug logging support (`NSTBROWSER_AI_AGENT_DEBUG=1`)\n';
  report += '- Comprehensive error handling\n';
  report += '- TypeScript type definitions\n\n';
  
  report += '## Next Steps\n\n';
  
  if (notImplementedApis === 0) {
    report += '✓ All APIs are implemented! Ready for CLI command implementation.\n';
  } else {
    report += `Implement the ${notImplementedApis} missing API methods listed above.\n`;
  }
  
  return report;
}

/**
 * Main function
 */
function main() {
  console.log('NSTBrowser API Coverage Analyzer');
  console.log('=================================\n');
  
  const report = generateReport();
  
  // Save report
  fs.writeFileSync(OUTPUT_FILE, report, 'utf8');
  
  console.log(`\nReport saved to: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log('\nPreview:\n');
  console.log(report.split('\n').slice(0, 20).join('\n'));
  console.log('\n... (see full report in file)');
}

// Run the script
main();
