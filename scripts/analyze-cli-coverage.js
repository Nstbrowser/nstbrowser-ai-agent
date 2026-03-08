#!/usr/bin/env node

/**
 * Analyze NSTBrowser CLI command coverage
 * 
 * This script analyzes which API methods have corresponding CLI commands
 * and generates a coverage report.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const DOCS_DIR = path.join(__dirname, '..', '.kiro', 'docs', 'nstbrowser-api');
const ACTIONS_FILE = path.join(__dirname, '..', 'src', 'nstbrowser-actions.ts');
const OUTPUT_FILE = path.join(DOCS_DIR, 'cli-coverage-report.md');

// Expected CLI commands based on API methods
const EXPECTED_COMMANDS = {
  'Browser Management': [
    { api: 'getBrowsers', command: 'nst_browser_list', cliExample: 'browser list' },
    { api: 'startBrowser', command: 'nst_browser_start', cliExample: 'browser start <profile>' },
    { api: 'startBrowsersBatch', command: 'nst_browser_start_batch', cliExample: 'browser start-batch <profile>...' },
    { api: 'startOnceBrowser', command: 'nst_browser_start_once', cliExample: 'browser start-once' },
    { api: 'stopBrowser', command: 'nst_browser_stop', cliExample: 'browser stop <profile>' },
    { api: 'stopAllBrowsers', command: 'nst_browser_stop_all', cliExample: 'browser stop-all' },
    { api: 'getBrowserPages', command: 'nst_browser_pages', cliExample: 'browser pages <profile>' },
    { api: 'getBrowserDebugger', command: 'nst_browser_debugger', cliExample: 'browser debugger <profile>' },
  ],
  'Profile Management': [
    { api: 'getProfiles', command: 'nst_profile_list', cliExample: 'profile list' },
    { api: 'getProfilesByCursor', command: 'nst_profile_list_cursor', cliExample: 'profile list --cursor <cursor>' },
    { api: 'createProfile', command: 'nst_profile_create', cliExample: 'profile create <name>' },
    { api: 'deleteProfile', command: 'nst_profile_delete', cliExample: 'profile delete <id>' },
    { api: 'deleteProfilesBatch', command: 'nst_profile_delete', cliExample: 'profile delete <id>...' },
    { api: 'getProfile (by name/id)', command: 'nst_profile_show', cliExample: 'profile show <name-or-id>' },
  ],
  'Profile Groups': [
    { api: 'getAllProfileGroups', command: 'nst_profile_groups_list', cliExample: 'profile groups list' },
    { api: 'changeProfileGroup', command: 'nst_profile_group_change', cliExample: 'profile groups change <group-id> <profile-id>' },
    { api: 'batchChangeProfileGroup', command: 'nst_profile_group_change', cliExample: 'profile groups change <group-id> <profile-id>...' },
  ],
  'Proxy Management': [
    { api: 'updateProfileProxy', command: 'nst_profile_proxy_update', cliExample: 'profile proxy update <id> --host <host> --port <port>' },
    { api: 'batchUpdateProxy', command: 'nst_profile_proxy_batch_update', cliExample: 'profile proxy batch-update <id>... --host <host>' },
    { api: 'resetProfileProxy', command: 'nst_profile_proxy_reset', cliExample: 'profile proxy reset <id>' },
    { api: 'batchResetProfileProxy', command: 'nst_profile_proxy_batch_reset', cliExample: 'profile proxy batch-reset <id>...' },
    { api: 'getProxyConfig', command: 'nst_profile_proxy_show', cliExample: 'profile proxy show <name-or-id>' },
  ],
  'Tag Management': [
    { api: 'getProfileTags', command: 'nst_profile_tags_list', cliExample: 'profile tags list' },
    { api: 'createProfileTags', command: 'nst_profile_tags_create', cliExample: 'profile tags create <id> <tag>' },
    { api: 'batchCreateProfileTags', command: 'nst_profile_tags_batch_create', cliExample: 'profile tags batch-create <id>... <tag>' },
    { api: 'updateProfileTags', command: 'nst_profile_tags_update', cliExample: 'profile tags update <id> <tag:color>...' },
    { api: 'batchUpdateProfileTags', command: 'nst_profile_tags_batch_update', cliExample: 'profile tags batch-update <id>... <tag:color>...' },
    { api: 'clearProfileTags', command: 'nst_profile_tags_clear', cliExample: 'profile tags clear <id>' },
    { api: 'batchClearProfileTags', command: 'nst_profile_tags_batch_clear', cliExample: 'profile tags batch-clear <id>...' },
  ],
  'Local Data Management': [
    { api: 'clearProfileCache', command: 'nst_profile_cache_clear', cliExample: 'profile cache clear <id>' },
    { api: 'clearProfileCookies', command: 'nst_profile_cookies_clear', cliExample: 'profile cookies clear <id>' },
  ],
  'CDP Endpoints': [
    { api: 'connectBrowser', command: 'nst_browser_connect', cliExample: 'browser connect <profile>' },
    { api: 'connectOnceBrowser', command: 'nst_browser_connect_once', cliExample: 'browser connect-once' },
    { api: 'getCdpUrl', command: 'nst_browser_cdp_url', cliExample: 'browser cdp-url <profile>' },
    { api: 'getCdpUrlOnce', command: 'nst_browser_cdp_url_once', cliExample: 'browser cdp-url-once' },
  ],
};

/**
 * Check if a command handler is implemented
 */
function checkCommandImplementation(actionsCode, commandName) {
  // Look for case statement handling this command
  const casePattern = new RegExp(`case\\s+['"]${commandName}['"]:`);
  return casePattern.test(actionsCode);
}

/**
 * Generate CLI coverage report
 */
function generateReport() {
  console.log('Analyzing CLI command coverage...\n');
  
  // Read actions code
  const actionsCode = fs.readFileSync(ACTIONS_FILE, 'utf8');
  
  let report = '# NSTBrowser CLI Command Coverage Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '## Summary\n\n';
  
  let totalCommands = 0;
  let implementedCommands = 0;
  let notImplementedCommands = 0;
  
  const categoryResults = {};
  
  // Analyze each category
  for (const [category, commands] of Object.entries(EXPECTED_COMMANDS)) {
    const results = commands.map(cmd => ({
      ...cmd,
      implemented: checkCommandImplementation(actionsCode, cmd.command),
    }));
    
    categoryResults[category] = results;
    
    const implemented = results.filter(r => r.implemented).length;
    const total = results.length;
    
    totalCommands += total;
    implementedCommands += implemented;
    notImplementedCommands += (total - implemented);
  }
  
  const coveragePercent = ((implementedCommands / totalCommands) * 100).toFixed(1);
  
  report += `- Total Commands: ${totalCommands}\n`;
  report += `- Implemented: ${implementedCommands}\n`;
  report += `- Not Implemented: ${notImplementedCommands}\n`;
  report += `- Coverage: ${coveragePercent}%\n\n`;
  
  // Detailed breakdown by category
  report += '## Coverage by Category\n\n';
  
  for (const [category, results] of Object.entries(categoryResults)) {
    const implemented = results.filter(r => r.implemented).length;
    const total = results.length;
    const percent = ((implemented / total) * 100).toFixed(1);
    
    report += `### ${category} (${implemented}/${total} - ${percent}%)\n\n`;
    
    // Implemented commands
    const implementedList = results.filter(r => r.implemented);
    if (implementedList.length > 0) {
      report += '#### ✓ Implemented\n\n';
      report += '| API Method | Command Action | CLI Example |\n';
      report += '|------------|----------------|-------------|\n';
      for (const cmd of implementedList) {
        report += `| \`${cmd.api}\` | \`${cmd.command}\` | \`${cmd.cliExample}\` |\n`;
      }
      report += '\n';
    }
    
    // Not implemented commands
    const notImplementedList = results.filter(r => !r.implemented);
    if (notImplementedList.length > 0) {
      report += '#### ✗ Not Implemented\n\n';
      report += '| API Method | Command Action | CLI Example |\n';
      report += '|------------|----------------|-------------|\n';
      for (const cmd of notImplementedList) {
        report += `| \`${cmd.api}\` | \`${cmd.command}\` | \`${cmd.cliExample}\` |\n`;
      }
      report += '\n';
    }
  }
  
  // Implementation recommendations
  report += '## Implementation Recommendations\n\n';
  
  if (notImplementedCommands > 0) {
    report += '### Missing Commands\n\n';
    report += 'The following commands should be implemented:\n\n';
    
    for (const [category, results] of Object.entries(categoryResults)) {
      const missing = results.filter(r => !r.implemented);
      if (missing.length > 0) {
        report += `**${category}:**\n\n`;
        for (const cmd of missing) {
          report += `- \`${cmd.command}\` - ${cmd.cliExample}\n`;
        }
        report += '\n';
      }
    }
  }
  
  report += '### Command Design Guidelines\n\n';
  report += '1. All commands should support `--json` output for AI agent parsing\n';
  report += '2. Commands should accept both profile name and profile ID\n';
  report += '3. Batch operations should accept multiple IDs as arguments\n';
  report += '4. Error messages should be clear and actionable\n';
  report += '5. Use kebab-case for all CLI flags (e.g., `--auto-close`)\n';
  report += '6. Provide helpful examples in `--help` output\n\n';
  
  report += '### Environment Variables\n\n';
  report += 'Commands should respect these environment variables:\n\n';
  report += '- `NST_HOST` - NSTBrowser API host (default: localhost)\n';
  report += '- `NST_PORT` - NSTBrowser API port (default: 8848)\n';
  report += '- `NST_API_KEY` - NSTBrowser API key (required)\n';
  report += '- `NST_PROFILE` - Default profile name or ID\n';
  report += '- `NSTBROWSER_AI_AGENT_DEBUG` - Enable debug logging\n\n';
  
  report += '## Next Steps\n\n';
  
  if (notImplementedCommands === 0) {
    report += '✓ All CLI commands are implemented!\n\n';
    report += 'Next steps:\n';
    report += '1. Update `cli/src/output.rs` with all command help text\n';
    report += '2. Update `README.md` with command examples\n';
    report += '3. Update `skills/nstbrowser-ai-agent/SKILL.md` for AI agents\n';
    report += '4. Add integration tests for all commands\n';
  } else {
    report += `Implement the ${notImplementedCommands} missing commands listed above.\n\n`;
    report += 'For each command:\n';
    report += '1. Add command handler in `src/nstbrowser-actions.ts`\n';
    report += '2. Add command type in `src/types.ts`\n';
    report += '3. Update daemon router in `src/daemon.ts`\n';
    report += '4. Add CLI parsing in Rust CLI (if needed)\n';
    report += '5. Write integration tests\n';
    report += '6. Update documentation\n';
  }
  
  return report;
}

/**
 * Main function
 */
function main() {
  console.log('NSTBrowser CLI Command Coverage Analyzer');
  console.log('=========================================\n');
  
  const report = generateReport();
  
  // Save report
  fs.writeFileSync(OUTPUT_FILE, report, 'utf8');
  
  console.log(`\nReport saved to: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log('\nPreview:\n');
  console.log(report.split('\n').slice(0, 25).join('\n'));
  console.log('\n... (see full report in file)');
}

// Run the script
main();
