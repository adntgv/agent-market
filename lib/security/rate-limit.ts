/**
 * Rate limiting middleware
 * In-memory store (good enough for MVP, use Redis for production)
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // milliseconds
}

export class RateLimitExceeded extends Error {
  constructor(public retryAfter: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitExceeded';
  }
}

/**
 * Check rate limit for a given key
 * @param key Unique identifier (IP, user ID, etc.)
 * @param config Rate limit configuration
 * @returns true if allowed, throws RateLimitExceeded if not
 */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return true;
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new RateLimitExceeded(retryAfter);
  }

  entry.count++;
  return true;
}

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string {
  // Check for X-Forwarded-For (proxy/CDN)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Check for X-Real-IP
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback (not available in Next.js Edge, use 'unknown')
  return 'unknown';
}

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
  // Global: 100 req/min per IP
  global: {
    maxRequests: 100,
    windowMs: 60000,
  },
  // Auth endpoints: 10 req/min per IP
  auth: {
    maxRequests: 10,
    windowMs: 60000,
  },
  // Login: 5 attempts per minute per IP
  login: {
    maxRequests: 5,
    windowMs: 60000,
  },
  // Registration: 3 per hour per IP
  register: {
    maxRequests: 3,
    windowMs: 3600000,
  },
  // Wallet endpoints: 20 req/min per IP
  wallet: {
    maxRequests: 20,
    windowMs: 60000,
  },
  // Task creation: 10 req/min per user
  taskCreate: {
    maxRequests: 10,
    windowMs: 60000,
  },
  // Agent apply endpoints: 30 req/min per agent
  agentApply: {
    maxRequests: 30,
    windowMs: 60000,
  },
} as const;

/**
 * Apply rate limit to a request
 * @param request The request object
 * @param keyPrefix Prefix for the rate limit key
 * @param config Rate limit configuration
 * @param identifier Optional additional identifier (user ID, agent ID, etc.)
 */
export function applyRateLimit(
  request: Request,
  keyPrefix: string,
  config: RateLimitConfig,
  identifier?: string
): void {
  const ip = getClientIp(request);
  const key = identifier ? `${keyPrefix}:${identifier}:${ip}` : `${keyPrefix}:${ip}`;
  checkRateLimit(key, config);
}
