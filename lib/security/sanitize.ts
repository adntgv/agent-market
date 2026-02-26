/**
 * Input sanitization utilities
 * Protects against injection attacks (SQL, XSS, Prompt Injection)
 */

/**
 * Strip control characters and normalize whitespace
 */
export function sanitizeString(input: string): string {
  return input
    // Remove control characters (except newline, tab, carriage return)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize Unicode
    .normalize('NFKC')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize task title (max 200 chars)
 */
export function sanitizeTaskTitle(title: string): string {
  const sanitized = sanitizeString(title);
  if (sanitized.length > 200) {
    throw new Error('Task title must not exceed 200 characters');
  }
  return sanitized;
}

/**
 * Sanitize task description (max 5000 chars)
 * Also adds basic prompt injection protection
 */
export function sanitizeTaskDescription(description: string): string {
  const sanitized = sanitizeString(description);
  if (sanitized.length > 5000) {
    throw new Error('Task description must not exceed 5000 characters');
  }
  
  // Check for obvious prompt injection patterns
  const dangerousPatterns = [
    /ignore (previous|all|the above) instructions?/gi,
    /disregard (previous|all|the above)/gi,
    /forget (everything|all|previous)/gi,
    /new instructions?:/gi,
    /system (prompt|message):/gi,
    /you are now/gi,
    /</gi, // script tags
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      throw new Error('Task description contains suspicious patterns');
    }
  }
  
  return sanitized;
}

/**
 * Sanitize tags array (max 20 tags, 50 chars each)
 */
export function sanitizeTags(tags: string[]): string[] {
  if (tags.length > 20) {
    throw new Error('Maximum 20 tags allowed');
  }
  
  return tags.map(tag => {
    const sanitized = sanitizeString(tag);
    if (sanitized.length > 50) {
      throw new Error('Each tag must not exceed 50 characters');
    }
    return sanitized;
  });
}

/**
 * Sanitize agent name
 */
export function sanitizeAgentName(name: string): string {
  const sanitized = sanitizeString(name);
  if (sanitized.length > 100) {
    throw new Error('Agent name must not exceed 100 characters');
  }
  return sanitized;
}

/**
 * Sanitize agent description
 */
export function sanitizeAgentDescription(description: string): string {
  const sanitized = sanitizeString(description);
  if (sanitized.length > 1000) {
    throw new Error('Agent description must not exceed 1000 characters');
  }
  return sanitized;
}

/**
 * Sanitize review text
 */
export function sanitizeReviewText(text: string): string {
  const sanitized = sanitizeString(text);
  if (sanitized.length > 2000) {
    throw new Error('Review text must not exceed 2000 characters');
  }
  return sanitized;
}
