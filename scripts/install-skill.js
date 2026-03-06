#!/usr/bin/env node

/**
 * Install nstbrowser-ai-agent skill to AI agent's skills directory
 * 
 * Usage:
 *   npx nstbrowser-ai-agent install-skill
 *   node scripts/install-skill.js
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function detectAIAgent() {
  const home = homedir();
  const agents = [];

  // Check for Kiro
  const kiroPath = join(home, '.kiro', 'skills');
  if (existsSync(join(home, '.kiro'))) {
    agents.push({ name: 'Kiro', path: kiroPath });
  }

  // Check for Claude Desktop (macOS)
  const claudeMacPath = join(home, 'Library', 'Application Support', 'Claude', 'skills');
  if (existsSync(join(home, 'Library', 'Application Support', 'Claude'))) {
    agents.push({ name: 'Claude Desktop', path: claudeMacPath });
  }

  // Check for Claude Desktop (Linux)
  const claudeLinuxPath = join(home, '.config', 'Claude', 'skills');
  if (existsSync(join(home, '.config', 'Claude'))) {
    agents.push({ name: 'Claude Desktop', path: claudeLinuxPath });
  }

  // Check for Claude Desktop (Windows)
  const claudeWinPath = join(home, 'AppData', 'Roaming', 'Claude', 'skills');
  if (existsSync(join(home, 'AppData', 'Roaming', 'Claude'))) {
    agents.push({ name: 'Claude Desktop', path: claudeWinPath });
  }

  return agents;
}

function getSkillsSource() {
  try {
    // Try to find skills in installed package
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const skillsPath = join(npmRoot, 'nstbrowser-ai-agent', 'skills', 'nstbrowser-ai-agent');
    
    if (existsSync(skillsPath)) {
      return skillsPath;
    }
  } catch (error) {
    // Ignore error
  }

  // Fallback to local skills directory
  const localSkillsPath = join(__dirname, '..', 'skills', 'nstbrowser-ai-agent');
  if (existsSync(localSkillsPath)) {
    return localSkillsPath;
  }

  return null;
}

function installSkill(targetPath, sourcePath) {
  try {
    // Create target directory if it doesn't exist
    if (!existsSync(targetPath)) {
      mkdirSync(targetPath, { recursive: true });
      log(`Created directory: ${targetPath}`, 'blue');
    }

    // Copy skills
    const skillTarget = join(targetPath, 'nstbrowser-ai-agent');
    cpSync(sourcePath, skillTarget, { recursive: true });
    
    return true;
  } catch (error) {
    log(`Error installing skill: ${error.message}`, 'red');
    return false;
  }
}

function verifyInstallation(targetPath) {
  const skillPath = join(targetPath, 'nstbrowser-ai-agent');
  const skillMd = join(skillPath, 'SKILL.md');
  const referencesDir = join(skillPath, 'references');
  const templatesDir = join(skillPath, 'templates');

  const checks = [
    { path: skillMd, name: 'SKILL.md' },
    { path: referencesDir, name: 'references/' },
    { path: templatesDir, name: 'templates/' },
  ];

  let allGood = true;
  for (const check of checks) {
    if (existsSync(check.path)) {
      log(`  ✓ ${check.name}`, 'green');
    } else {
      log(`  ✗ ${check.name} not found`, 'red');
      allGood = false;
    }
  }

  return allGood;
}

async function main() {
  log('\n========================================', 'blue');
  log('nstbrowser-ai-agent Skill Installer', 'blue');
  log('========================================\n', 'blue');

  // Step 1: Find skills source
  log('[1/4] Locating skills...', 'yellow');
  const sourcePath = getSkillsSource();
  
  if (!sourcePath) {
    log('✗ Skills not found. Please install nstbrowser-ai-agent first:', 'red');
    log('  npm install -g nstbrowser-ai-agent\n', 'blue');
    process.exit(1);
  }
  
  log(`✓ Found skills at: ${sourcePath}\n`, 'green');

  // Step 2: Detect AI agents
  log('[2/4] Detecting AI agents...', 'yellow');
  const agents = detectAIAgent();
  
  if (agents.length === 0) {
    log('✗ No AI agents detected.', 'red');
    log('\nManual installation:', 'yellow');
    log(`  Copy skills from: ${sourcePath}`, 'blue');
    log('  To your AI agent\'s skills directory\n', 'blue');
    process.exit(1);
  }
  
  log(`✓ Found ${agents.length} AI agent(s):\n`, 'green');
  agents.forEach((agent, i) => {
    log(`  ${i + 1}. ${agent.name}`, 'blue');
    log(`     ${agent.path}`, 'blue');
  });
  log('');

  // Step 3: Install to all detected agents
  log('[3/4] Installing skills...', 'yellow');
  let successCount = 0;
  
  for (const agent of agents) {
    log(`\nInstalling to ${agent.name}...`, 'blue');
    if (installSkill(agent.path, sourcePath)) {
      log(`✓ Installed to ${agent.name}`, 'green');
      successCount++;
    } else {
      log(`✗ Failed to install to ${agent.name}`, 'red');
    }
  }
  
  log('');

  // Step 4: Verify installation
  log('[4/4] Verifying installation...', 'yellow');
  let verifyCount = 0;
  
  for (const agent of agents) {
    log(`\n${agent.name}:`, 'blue');
    if (verifyInstallation(agent.path)) {
      verifyCount++;
    }
  }
  
  log('');

  // Summary
  log('========================================', 'blue');
  log('Installation Summary', 'blue');
  log('========================================\n', 'blue');
  
  if (successCount === agents.length && verifyCount === agents.length) {
    log(`✓ Successfully installed to ${successCount}/${agents.length} AI agent(s)`, 'green');
    log('\nThe nstbrowser-ai-agent skill is now available!', 'green');
    log('\nNext steps:', 'yellow');
    log('  1. Restart your AI agent', 'blue');
    log('  2. Ask your AI agent to use nstbrowser-ai-agent', 'blue');
    log('  3. Example: "Use nstbrowser to open example.com"\n', 'blue');
  } else {
    log(`⚠ Installed to ${successCount}/${agents.length} AI agent(s)`, 'yellow');
    log('\nSome installations may have failed.', 'yellow');
    log('Check the errors above for details.\n', 'yellow');
  }

  log('Documentation:', 'yellow');
  log('  https://github.com/nstbrowser/nstbrowser-ai-agent\n', 'blue');
}

main().catch((error) => {
  log(`\nError: ${error.message}`, 'red');
  process.exit(1);
});
