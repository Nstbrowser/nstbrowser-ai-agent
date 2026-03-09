/**
 * Security utilities for protecting sensitive information
 * 
 * This module provides functions to mask, sanitize, and protect sensitive data
 * in logs, error messages, and debug output.
 */

/**
 * Sensitive field names that should be masked in logs and output
 */
const SENSITIVE_FIELDS = [
  'apiKey',
  'api_key',
  'x-api-key',
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'auth',
  'authorization',
  'credential',
  'key',
  'private',
  'proxyPassword',
  'proxy_password',
] as const;

/**
 * Patterns to detect sensitive data in strings
 */
const SENSITIVE_PATTERNS = [
  // API keys (common formats)
  /[a-zA-Z0-9]{32,}/g, // Long alphanumeric strings
  // Tokens
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
  // Basic auth
  /Basic\s+[a-zA-Z0-9+/]+=*/gi,
  // URLs with credentials
  /(https?:\/\/)[^:]+:[^@]+@/gi,
] as const;

/**
 * Mask an API key, showing only first and last 4 characters
 */
export function maskApiKey(key: string): string {
  if (!key || typeof key !== 'string') return '***';
  if (key.length <= 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

/**
 * Mask a password completely
 */
export function maskPassword(password: string): string {
  if (!password || typeof password !== 'string') return '';
  return '***';
}

/**
 * Mask a proxy URL, hiding username and password
 * Example: http://user:pass@proxy.com:8080 -> http://***:***@proxy.com:8080
 */
export function maskProxyUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  
  // Match proxy URL with credentials
  const match = url.match(/^(https?:\/\/)([^:]+):([^@]+)@(.+)$/);
  if (match) {
    const [, protocol, , , rest] = match;
    return `${protocol}***:***@${rest}`;
  }
  
  return url;
}

/**
 * Mask sensitive data in a string
 */
export function maskSensitiveString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  
  let masked = str;
  
  // Mask Bearer tokens
  masked = masked.replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi, 'Bearer ***');
  
  // Mask Basic auth
  masked = masked.replace(/Basic\s+[a-zA-Z0-9+/]+=*/gi, 'Basic ***');
  
  // Mask URLs with credentials
  masked = masked.replace(/(https?:\/\/)[^:]+:[^@]+@/gi, '$1***:***@');
  
  // Mask long alphanumeric strings that look like API keys (32+ chars)
  masked = masked.replace(/\b[a-zA-Z0-9]{32,}\b/g, (match) => {
    if (match.length <= 8) return match;
    return `${match.substring(0, 4)}...${match.substring(match.length - 4)}`;
  });
  
  return masked;
}

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(sensitive => lowerField.includes(sensitive));
}

/**
 * Sanitize an object by masking sensitive fields
 * This recursively processes nested objects and arrays
 */
export function sanitizeObject(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[Max depth reached]';
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveField(key)) {
        // Mask sensitive fields
        if (typeof value === 'string') {
          if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
            sanitized[key] = maskApiKey(value);
          } else if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
            sanitized[key] = maskPassword(value);
          } else if (key.toLowerCase().includes('url') && value.includes('@')) {
            sanitized[key] = maskProxyUrl(value);
          } else {
            sanitized[key] = '***';
          }
        } else {
          sanitized[key] = '***';
        }
      } else if (typeof value === 'string') {
        // Check if string contains sensitive patterns
        sanitized[key] = maskSensitiveString(value);
      } else {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }
    
    return sanitized;
  }
  
  // Return primitives as-is
  return obj;
}

/**
 * Sanitize log data before outputting
 * This is the main function to use for logging
 */
export function sanitizeLogData(data: unknown): unknown {
  return sanitizeObject(data);
}

/**
 * Create a safe error message that doesn't leak sensitive information
 */
export function createSafeErrorMessage(error: Error | unknown, context?: Record<string, unknown>): string {
  const message = error instanceof Error ? error.message : String(error);
  const maskedMessage = maskSensitiveString(message);
  
  if (context) {
    const sanitizedContext = sanitizeObject(context);
    return `${maskedMessage} | Context: ${JSON.stringify(sanitizedContext)}`;
  }
  
  return maskedMessage;
}

/**
 * Validate that sensitive data is not being logged
 * Throws an error if sensitive data is detected in debug mode
 */
export function validateNoSensitiveData(data: unknown): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const str = JSON.stringify(data);
  
  // Check for common sensitive patterns
  if (/[a-zA-Z0-9]{40,}/.test(str)) {
    console.warn('[Security Warning] Potential API key or token detected in log data');
  }
  
  if (/password|secret|token/i.test(str)) {
    const obj = typeof data === 'object' ? data : {};
    const keys = Object.keys(obj as Record<string, unknown>);
    const sensitiveKeys = keys.filter(k => isSensitiveField(k));
    
    if (sensitiveKeys.length > 0) {
      console.warn(`[Security Warning] Sensitive fields detected: ${sensitiveKeys.join(', ')}`);
    }
  }
}

/**
 * Environment variable protection
 * Returns masked environment variables for logging
 */
export function getMaskedEnvVars(): Record<string, string> {
  const envVars: Record<string, string> = {};
  
  const relevantEnvVars = [
    'NST_API_KEY',
    'NST_HOST',
    'NST_PORT',
    'NST_PROFILE',
    'NST_PROFILE_ID',
    'NSTBROWSER_AI_AGENT_DEBUG',
    'NSTBROWSER_AI_AGENT_SESSION',
    'NSTBROWSER_AI_AGENT_ENCRYPTION_KEY',
  ];
  
  for (const key of relevantEnvVars) {
    const value = process.env[key];
    if (value) {
      if (key.includes('KEY') || key.includes('SECRET') || key.includes('PASSWORD')) {
        envVars[key] = maskApiKey(value);
      } else {
        envVars[key] = value;
      }
    }
  }
  
  return envVars;
}

/**
 * Security audit log entry
 */
export interface SecurityAuditEntry {
  timestamp: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
}

/**
 * Simple in-memory audit log (for development/debugging)
 * In production, this should be persisted to a file or external service
 */
const auditLog: SecurityAuditEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 1000;

/**
 * Add an entry to the security audit log
 */
export function addAuditLogEntry(entry: Omit<SecurityAuditEntry, 'timestamp'>): void {
  const fullEntry: SecurityAuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    details: entry.details ? sanitizeObject(entry.details) as Record<string, unknown> : undefined,
  };
  
  auditLog.push(fullEntry);
  
  // Keep log size manageable
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.shift();
  }
  
  // In production, persist to file or external service
  if (process.env.NSTBROWSER_AI_AGENT_AUDIT_LOG) {
    // TODO: Implement file-based audit logging
  }
}

/**
 * Get audit log entries
 */
export function getAuditLog(limit?: number): SecurityAuditEntry[] {
  if (limit) {
    return auditLog.slice(-limit);
  }
  return [...auditLog];
}

/**
 * Clear audit log (for testing)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}
