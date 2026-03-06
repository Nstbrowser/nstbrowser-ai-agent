import { describe, it, expect } from 'vitest';
import { isAllowedOrigin } from './stream-server.js';

describe('isAllowedOrigin', () => {
  describe('allowed origins', () => {
    it('should allow connections with no origin (CLI tools)', () => {
      expect(isAllowedOrigin(undefined)).toBe(true);
    });

    it('should allow empty string origin', () => {
      expect(isAllowedOrigin('')).toBe(true);
    });

    it('should allow file:// protocol origins', () => {
      expect(isAllowedOrigin('file:///')).toBe(true);
      expect(isAllowedOrigin('file:///path/to/file.html')).toBe(true);
    });

    it('should allow http://localhost origins', () => {
      expect(isAllowedOrigin('http://localhost')).toBe(true);
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedOrigin('http://localhost:8080')).toBe(true);
      expect(isAllowedOrigin('http://localhost:8080/path')).toBe(true);
    });

    it('should allow https://localhost origins', () => {
      expect(isAllowedOrigin('https://localhost')).toBe(true);
      expect(isAllowedOrigin('https://localhost:3000')).toBe(true);
    });

    it('should allow http://127.0.0.1 origins', () => {
      expect(isAllowedOrigin('http://127.0.0.1')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:8080/path')).toBe(true);
    });

    it('should allow IPv6 loopback origins', () => {
      expect(isAllowedOrigin('http://[::1]')).toBe(true);
      expect(isAllowedOrigin('http://[::1]:3000')).toBe(true);
    });
  });

  describe('rejected origins', () => {
    it('should reject remote origins', () => {
      expect(isAllowedOrigin('https://example.com')).toBe(false);
      expect(isAllowedOrigin('http://example.com')).toBe(false);
      expect(isAllowedOrigin('https://example.com:3000')).toBe(false);
    });

    it('should reject origins with localhost in path but not hostname', () => {
      expect(isAllowedOrigin('https://example.com/localhost')).toBe(false);
    });

    it('should reject origins that look like localhost but are not', () => {
      expect(isAllowedOrigin('http://localhost.example.com')).toBe(false);
      expect(isAllowedOrigin('http://notlocalhost')).toBe(false);
    });

    it('should reject invalid origin URLs', () => {
      expect(isAllowedOrigin('not-a-url')).toBe(false);
      expect(isAllowedOrigin('://invalid')).toBe(false);
    });
  });
});
