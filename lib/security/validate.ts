/**
 * Input validation utilities
 * Validates data types, formats, and ranges
 */

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate and sanitize UUID (prevent path traversal)
 */
export function validateUUID(uuid: string, fieldName = 'ID'): string {
  if (!uuid || typeof uuid !== 'string') {
    throw new Error(`${fieldName} is required`);
  }

  if (!isValidUUID(uuid)) {
    throw new Error(`Invalid ${fieldName} format`);
  }

  return uuid;
}

/**
 * Validate monetary amount
 * - Must be positive
 * - Max 2 decimal places
 * - Max value: 10000
 */
export function validateAmount(amount: any, fieldName = 'amount'): number {
  // Convert to number
  const num = parseFloat(amount);

  // Check if valid number
  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  // Check if positive
  if (num <= 0) {
    throw new Error(`${fieldName} must be greater than 0`);
  }

  // Check maximum
  if (num > 10000) {
    throw new Error(`${fieldName} cannot exceed 10000`);
  }

  // Check decimal places
  const decimalPlaces = (num.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    throw new Error(`${fieldName} cannot have more than 2 decimal places`);
  }

  return num;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  if (email.length > 255) {
    throw new Error('Email too long');
  }

  return email.toLowerCase().trim();
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName = 'field'
): string {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required`);
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must not exceed ${maxLength} characters`);
  }

  return trimmed;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName = 'value'
): T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(
      `Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}`
    );
  }
  return value as T;
}

/**
 * Validate task status
 */
export const TASK_STATUSES = [
  'draft',
  'open',
  'matching',
  'assigned',
  'in_progress',
  'completed',
  'approved',
  'disputed',
  'cancelled',
] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

export function validateTaskStatus(status: string): TaskStatus {
  return validateEnum(status, TASK_STATUSES, 'task status');
}

/**
 * Validate agent type
 */
export const AGENT_TYPES = [
  'autonomous',
  'human_in_loop',
  'api_service',
] as const;

export type AgentType = typeof AGENT_TYPES[number];

export function validateAgentType(type: string): AgentType {
  return validateEnum(type, AGENT_TYPES, 'agent type');
}

/**
 * Validate rating (1-5)
 */
export function validateRating(rating: any): number {
  const num = parseInt(rating, 10);

  if (isNaN(num)) {
    throw new Error('Rating must be a number');
  }

  if (num < 1 || num > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  return num;
}

/**
 * Validate URL format
 */
export function validateUrl(url: string, fieldName = 'URL'): string {
  if (!url || typeof url !== 'string') {
    throw new Error(`${fieldName} is required`);
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`${fieldName} must use HTTP or HTTPS protocol`);
    }
    return url;
  } catch {
    throw new Error(`Invalid ${fieldName} format`);
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: any, limit?: any) {
  const pageNum = page ? parseInt(page, 10) : 1;
  const limitNum = limit ? parseInt(limit, 10) : 20;

  if (isNaN(pageNum) || pageNum < 1) {
    throw new Error('Invalid page number');
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  return { page: pageNum, limit: limitNum };
}
