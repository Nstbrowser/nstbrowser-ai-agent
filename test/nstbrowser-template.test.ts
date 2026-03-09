/**
 * Tests for Profile Template System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  createProfileFromTemplate,
  exportTemplate,
  importTemplate,
  initializeDefaultTemplates,
} from '../src/nstbrowser-template.js';

describe('Profile Template System', () => {
  const testTemplatesDir = path.join(os.tmpdir(), 'nstbrowser-template-test');
  const originalHome = process.env.HOME;

  beforeEach(() => {
    // Use temporary directory for tests
    process.env.HOME = testTemplatesDir;
    if (fs.existsSync(testTemplatesDir)) {
      fs.rmSync(testTemplatesDir, { recursive: true });
    }
    fs.mkdirSync(testTemplatesDir, { recursive: true });
  });

  afterEach(() => {
    // Restore original HOME
    process.env.HOME = originalHome;
    // Clean up test directory
    if (fs.existsSync(testTemplatesDir)) {
      fs.rmSync(testTemplatesDir, { recursive: true });
    }
  });

  describe('createTemplate', () => {
    it('should create a new template', () => {
      const template = createTemplate(
        'test-template',
        {
          platform: 'Windows',
          kernel: '120.0.0.0',
        },
        'Test template description'
      );

      expect(template.name).toBe('test-template');
      expect(template.description).toBe('Test template description');
      expect(template.config.platform).toBe('Windows');
      expect(template.config.kernel).toBe('120.0.0.0');
      expect(template.createdAt).toBeDefined();
      expect(template.updatedAt).toBeDefined();
    });

    it('should throw error if template already exists', () => {
      createTemplate('test-template', { platform: 'Windows' });

      expect(() => {
        createTemplate('test-template', { platform: 'macOS' });
      }).toThrow("Template 'test-template' already exists");
    });

    it('should create template with proxy config', () => {
      const template = createTemplate('proxy-template', {
        platform: 'Windows',
        proxy: {
          type: 'http',
          host: 'proxy.example.com',
          port: 8080,
        },
      });

      expect(template.config.proxy).toBeDefined();
      expect(template.config.proxy?.type).toBe('http');
      expect(template.config.proxy?.host).toBe('proxy.example.com');
    });
  });

  describe('getTemplate', () => {
    it('should get existing template', () => {
      createTemplate('test-template', { platform: 'Windows' });

      const template = getTemplate('test-template');

      expect(template).not.toBeNull();
      expect(template?.name).toBe('test-template');
    });

    it('should return null for non-existent template', () => {
      const template = getTemplate('non-existent');

      expect(template).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('should list all templates', () => {
      createTemplate('template-1', { platform: 'Windows' });
      createTemplate('template-2', { platform: 'macOS' });
      createTemplate('template-3', { platform: 'Linux' });

      const templates = listTemplates();

      expect(templates).toHaveLength(3);
      expect(templates.map((t) => t.name)).toContain('template-1');
      expect(templates.map((t) => t.name)).toContain('template-2');
      expect(templates.map((t) => t.name)).toContain('template-3');
    });

    it('should return empty array when no templates exist', () => {
      const templates = listTemplates();

      expect(templates).toHaveLength(0);
    });
  });

  describe('updateTemplate', () => {
    it('should update template config', () => {
      createTemplate('test-template', { platform: 'Windows' });

      const updated = updateTemplate('test-template', {
        kernel: '121.0.0.0',
      });

      expect(updated.config.platform).toBe('Windows');
      expect(updated.config.kernel).toBe('121.0.0.0');
    });

    it('should update template description', () => {
      createTemplate('test-template', { platform: 'Windows' }, 'Old description');

      const updated = updateTemplate('test-template', {}, 'New description');

      expect(updated.description).toBe('New description');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        updateTemplate('non-existent', { platform: 'Windows' });
      }).toThrow("Template 'non-existent' not found");
    });
  });

  describe('deleteTemplate', () => {
    it('should delete existing template', () => {
      createTemplate('test-template', { platform: 'Windows' });

      deleteTemplate('test-template');

      const template = getTemplate('test-template');
      expect(template).toBeNull();
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        deleteTemplate('non-existent');
      }).toThrow("Template 'non-existent' not found");
    });
  });

  describe('createProfileFromTemplate', () => {
    it('should create profile config from template', () => {
      createTemplate('test-template', {
        platform: 'Windows',
        kernel: '120.0.0.0',
      });

      const config = createProfileFromTemplate('test-template', 'my-profile');

      expect(config.name).toBe('my-profile');
      expect(config.platform).toBe('Windows');
      expect(config.kernel).toBe('120.0.0.0');
    });

    it('should apply overrides', () => {
      createTemplate('test-template', {
        platform: 'Windows',
        kernel: '120.0.0.0',
      });

      const config = createProfileFromTemplate('test-template', 'my-profile', {
        kernel: '121.0.0.0',
      });

      expect(config.name).toBe('my-profile');
      expect(config.platform).toBe('Windows');
      expect(config.kernel).toBe('121.0.0.0');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        createProfileFromTemplate('non-existent', 'my-profile');
      }).toThrow("Template 'non-existent' not found");
    });
  });

  describe('exportTemplate', () => {
    it('should export template as JSON', () => {
      createTemplate('test-template', {
        platform: 'Windows',
        kernel: '120.0.0.0',
      });

      const json = exportTemplate('test-template');
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('test-template');
      expect(parsed.config.platform).toBe('Windows');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        exportTemplate('non-existent');
      }).toThrow("Template 'non-existent' not found");
    });
  });

  describe('importTemplate', () => {
    it('should import template from JSON', () => {
      const json = JSON.stringify({
        name: 'imported-template',
        description: 'Imported template',
        config: {
          platform: 'Windows',
          kernel: '120.0.0.0',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const template = importTemplate(json);

      expect(template.name).toBe('imported-template');
      expect(template.description).toBe('Imported template');
      expect(template.config.platform).toBe('Windows');
    });

    it('should override template name', () => {
      const json = JSON.stringify({
        name: 'original-name',
        config: { platform: 'Windows' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const template = importTemplate(json, 'new-name');

      expect(template.name).toBe('new-name');
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        importTemplate('invalid json');
      }).toThrow('Invalid template JSON');
    });

    it('should throw error for invalid template structure', () => {
      const json = JSON.stringify({ invalid: 'structure' });

      expect(() => {
        importTemplate(json);
      }).toThrow('Invalid template structure');
    });
  });

  describe('initializeDefaultTemplates', () => {
    it('should create default templates', () => {
      initializeDefaultTemplates();

      const templates = listTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.map((t) => t.name)).toContain('windows-basic');
      expect(templates.map((t) => t.name)).toContain('macos-basic');
      expect(templates.map((t) => t.name)).toContain('linux-basic');
    });

    it('should not overwrite existing templates', () => {
      createTemplate('custom-template', { platform: 'Windows' });

      initializeDefaultTemplates();

      const templates = listTemplates();
      expect(templates.map((t) => t.name)).toContain('custom-template');
    });

    it('should not create defaults if templates already exist', () => {
      createTemplate('custom-template', { platform: 'Windows' });

      initializeDefaultTemplates();

      const templates = listTemplates();
      // Should only have the custom template, not defaults
      expect(templates).toHaveLength(1);
    });
  });
});
