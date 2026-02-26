import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applyRateLimit, RATE_LIMITS, RateLimitExceeded, getClientIp } from './lib/security/rate-limit';
import { logSecurityEvent } from './lib/security/audit-log';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // Apply security headers
  const response = NextResponse.next();
  
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );
  
  // Only set HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  // Apply rate limiting
  try {
    // Auth endpoints (login, register)
    if (pathname === '/api/auth/register') {
      applyRateLimit(request, 'register', RATE_LIMITS.register);
    } else if (pathname.startsWith('/api/auth') && !pathname.includes('nextauth')) {
      applyRateLimit(request, 'auth', RATE_LIMITS.auth);
    }
    // Wallet endpoints
    else if (pathname.startsWith('/api/wallet')) {
      applyRateLimit(request, 'wallet', RATE_LIMITS.wallet);
    }
    // Task creation
    else if (pathname === '/api/tasks' && request.method === 'POST') {
      applyRateLimit(request, 'task-create', RATE_LIMITS.taskCreate);
    }
    // Agent apply endpoints
    else if (pathname.match(/\/api\/tasks\/[^/]+\/apply$/)) {
      applyRateLimit(request, 'agent-apply', RATE_LIMITS.agentApply);
    }
    // Global rate limit for all API routes
    else if (pathname.startsWith('/api/')) {
      applyRateLimit(request, 'global', RATE_LIMITS.global);
    }
  } catch (error) {
    if (error instanceof RateLimitExceeded) {
      logSecurityEvent(
        'security.rate_limit_exceeded',
        {
          path: pathname,
          method: request.method,
          retryAfter: error.retryAfter,
        },
        undefined,
        ip
      );

      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retry_after: error.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': error.retryAfter.toString(),
            ...Object.fromEntries(response.headers.entries()),
          },
        }
      );
    }
  }

  return response;
}

// Apply middleware to all API routes
export const config = {
  matcher: [
    '/api/:path*',
    // Add other paths that need security headers
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
