/**
 * Profile template system for quick profile creation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ProfileConfig, ProxyConfig, FingerprintConfig } from './nstbrowser-types.js';

export interface ProfileTemplate {
  name: string;
  description?: string;
  config: Omit<ProfileConfig, 'name'>;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateStorage {
  version: string;
  templates: Record<string, ProfileTemplate>;
}

/**
 * Get templates directory path
 */
function getTemplatesDir(): string {
  const homeDir = os.homedir();
  const templatesDir = path.join(homeDir, '.nstbrowser-ai-agent', 'templates');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  
  return templatesDir;
}

/**
 * Get templates file path
 */
function getTemplatesFile(): string {
  return path.join(getTemplatesDir(), 'templates.json');
}

/**
 * Load all templates
 */
export function loadTemplates(): TemplateStorage {
  const templatesFile = getTemplatesFile();
  
  if (!fs.existsSync(templatesFile)) {
    return {
      version: '1.0',
      templates: {},
    };
  }
  
  try {
    const content = fs.readFileSync(templatesFile, 'utf-8');
    return JSON.parse(content) as TemplateStorage;
  } catch (error) {
    console.error('Failed to load templates:', error);
    return {
      version: '1.0',
      templates: {},
    };
  }
}

/**
 * Save templates
 */
export function saveTemplates(storage: TemplateStorage): void {
  const templatesFile = getTemplatesFile();
  
  try {
    fs.writeFileSync(templatesFile, JSON.stringify(storage, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save templates: ${error}`);
  }
}

/**
 * Create a new template
 */
export function createTemplate(
  name: string,
  config: Omit<ProfileConfig, 'name'>,
  description?: string
): ProfileTemplate {
  const storage = loadTemplates();
  
  if (storage.templates[name]) {
    throw new Error(`Template '${name}' already exists`);
  }
  
  const template: ProfileTemplate = {
    name,
    description,
    config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  storage.templates[name] = template;
  saveTemplates(storage);
  
  return template;
}

/**
 * Get a template by name
 */
export function getTemplate(name: string): ProfileTemplate | null {
  const storage = loadTemplates();
  return storage.templates[name] || null;
}

/**
 * List all templates
 */
export function listTemplates(): ProfileTemplate[] {
  const storage = loadTemplates();
  return Object.values(storage.templates);
}

/**
 * Update a template
 */
export function updateTemplate(
  name: string,
  config: Partial<Omit<ProfileConfig, 'name'>>,
  description?: string
): ProfileTemplate {
  const storage = loadTemplates();
  
  const template = storage.templates[name];
  if (!template) {
    throw new Error(`Template '${name}' not found`);
  }
  
  // Merge config
  template.config = {
    ...template.config,
    ...config,
  };
  
  if (description !== undefined) {
    template.description = description;
  }
  
  template.updatedAt = new Date().toISOString();
  
  storage.templates[name] = template;
  saveTemplates(storage);
  
  return template;
}

/**
 * Delete a template
 */
export function deleteTemplate(name: string): void {
  const storage = loadTemplates();
  
  if (!storage.templates[name]) {
    throw new Error(`Template '${name}' not found`);
  }
  
  delete storage.templates[name];
  saveTemplates(storage);
}

/**
 * Create profile config from template
 */
export function createProfileFromTemplate(
  templateName: string,
  profileName: string,
  overrides?: Partial<ProfileConfig>
): ProfileConfig {
  const template = getTemplate(templateName);
  
  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }
  
  return {
    name: profileName,
    ...template.config,
    ...overrides,
  };
}

/**
 * Export template to JSON
 */
export function exportTemplate(name: string): string {
  const template = getTemplate(name);
  
  if (!template) {
    throw new Error(`Template '${name}' not found`);
  }
  
  return JSON.stringify(template, null, 2);
}

/**
 * Import template from JSON
 */
export function importTemplate(json: string, overwriteName?: string): ProfileTemplate {
  let template: ProfileTemplate;
  
  try {
    template = JSON.parse(json) as ProfileTemplate;
  } catch (error) {
    throw new Error(`Invalid template JSON: ${error}`);
  }
  
  // Validate template structure
  if (!template.name || !template.config) {
    throw new Error('Invalid template structure: missing name or config');
  }
  
  // Use override name if provided
  const name = overwriteName || template.name;
  
  const storage = loadTemplates();
  
  // Update timestamps
  template.name = name;
  template.updatedAt = new Date().toISOString();
  
  storage.templates[name] = template;
  saveTemplates(storage);
  
  return template;
}

/**
 * Batch create profiles from template
 */
export async function batchCreateFromTemplate(
  templateName: string,
  profileNames: string[],
  createProfileFn: (config: ProfileConfig) => Promise<any>,
  options: {
    onProgress?: (completed: number, total: number, current: string) => void;
    onError?: (error: Error, profileName: string) => void;
  } = {}
): Promise<{ succeeded: any[]; failed: Array<{ name: string; error: Error }> }> {
  const template = getTemplate(templateName);
  
  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }
  
  const succeeded: any[] = [];
  const failed: Array<{ name: string; error: Error }> = [];
  
  for (let i = 0; i < profileNames.length; i++) {
    const profileName = profileNames[i];
    
    try {
      const config = createProfileFromTemplate(templateName, profileName);
      const profile = await createProfileFn(config);
      succeeded.push(profile);
      
      if (options.onProgress) {
        options.onProgress(i + 1, profileNames.length, profileName);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      failed.push({ name: profileName, error: err });
      
      if (options.onError) {
        options.onError(err, profileName);
      }
    }
  }
  
  return { succeeded, failed };
}

/**
 * Get default templates
 */
export function getDefaultTemplates(): Record<string, Omit<ProfileConfig, 'name'>> {
  return {
    'windows-basic': {
      platform: 'Windows',
      kernel: '120.0.0.0',
    },
    'windows-proxy': {
      platform: 'Windows',
      kernel: '120.0.0.0',
      proxy: {
        type: 'http',
        host: 'proxy.example.com',
        port: 8080,
      },
    },
    'macos-basic': {
      platform: 'macOS',
      kernel: '120.0.0.0',
    },
    'linux-basic': {
      platform: 'Linux',
      kernel: '120.0.0.0',
    },
  };
}

/**
 * Initialize default templates if none exist
 */
export function initializeDefaultTemplates(): void {
  const storage = loadTemplates();
  
  if (Object.keys(storage.templates).length > 0) {
    return; // Already have templates
  }
  
  const defaults = getDefaultTemplates();
  
  for (const [name, config] of Object.entries(defaults)) {
    storage.templates[name] = {
      name,
      description: `Default ${name} template`,
      config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  saveTemplates(storage);
}
