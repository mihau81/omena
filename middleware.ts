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

  // Helper: create redirect URL that respects basePath
  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return url;
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NEXTAUTH_URL?.startsWith('https://'),
  });

  const userType = token?.userType ?? 'anonymous';

  // Reject revoked tokens (admin deactivated/deleted while session was active)
  if (userType === 'revoked') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session revoked' }, { status: 401 });
    }
    const response = NextResponse.redirect(redirectTo('/en/login'));
    applySecurityHeaders(response);
    return response;
  }

  // Protect /api/me/* routes — return 401 if not authenticated user
  if (pathname.startsWith('/api/me')) {
    if (!token || userType !== 'user') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }
  }

  // Protect /[locale]/account/* routes — redirect to login if not user
  const accountMatch = pathname.match(/^\/([a-z]{2})\/account(\/|$)/);
  if (accountMatch) {
    if (!token || userType !== 'user') {
      const locale = accountMatch[1];
      const response = NextResponse.redirect(redirectTo(`/${locale}/login`));
      applySecurityHeaders(response);
      return response;
    }
  }

  // Redirect /admin/login to unified login page
  if (pathname === '/admin/login') {
    const response = NextResponse.redirect(redirectTo('/en/login'));
    applySecurityHeaders(response);
    return response;
  }

  // Protect /admin/* routes — redirect to main login if not admin
  if (pathname.startsWith('/admin')) {
    if (!token || userType !== 'admin') {
      const response = NextResponse.redirect(redirectTo('/en/login'));
      applySecurityHeaders(response);
      return response;
    }
  }

  // Protect /api/admin/* routes — return 401 if not admin
  if (pathname.startsWith('/api/admin')) {
    if (!token || userType !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 },
      );
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);

  // Propagate user info to downstream handlers via headers
  response.headers.set('x-user-visibility', String(token?.visibilityLevel ?? 0));
  response.headers.set('x-user-id', token?.sub ?? '');
  response.headers.set('x-user-type', userType);

  // Track page views for authenticated users (fire-and-forget)
  if (token?.sub && !pathname.startsWith('/api/') && !pathname.startsWith('/_next/') && !pathname.includes('.')) {
    const baseUrl = request.nextUrl.origin + (request.nextUrl.basePath || '');
    try {
      fetch(`${baseUrl}/api/internal/page-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.NEXTAUTH_SECRET || '',
        },
        body: JSON.stringify({
          userId: token.sub,
          userType,
          path: pathname,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          userAgent: request.headers.get('user-agent') || null,
        }),
      }).catch(() => {}); // fire-and-forget
    } catch {
      // Ignore errors — page view tracking is non-critical
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
};
