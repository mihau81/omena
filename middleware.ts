import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Security headers applied to all responses
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.youtube.com http://localhost:9000 http://minio:9000",
    "font-src 'self'",
    "frame-src 'self' https://www.youtube-nocookie.com https://js.stripe.com",
    "connect-src 'self' https://api.nbp.pl https://api.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '),
};

function applySecurityHeaders(response: NextResponse): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const userType = token?.userType ?? 'anonymous';

  // Reject revoked tokens (admin deactivated/deleted while session was active)
  if (userType === 'revoked') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session revoked' }, { status: 401 });
    }
    // For page routes, redirect to login
    const response = NextResponse.redirect(new URL('/admin/login', request.url));
    applySecurityHeaders(response);
    return response;
  }

  // Protect /admin/* routes — redirect to admin login if not admin
  if (pathname.startsWith('/admin')) {
    // Allow access to admin login page
    if (pathname === '/admin/login') {
      // If already logged in as admin, redirect to dashboard
      if (token && userType === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      const response = NextResponse.next();
      applySecurityHeaders(response);
      return response;
    }

    // All other admin routes require admin auth
    if (!token || userType !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Protect /api/admin/* routes — return 401 if not admin
  // Exception: /api/admin/login must be accessible without auth
  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
    if (!token || userType !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 },
      );
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
};
