import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const userVisibility = token?.visibilityLevel ?? 0;
  const userId = token?.sub ?? '';
  const userType = token?.userType ?? 'anonymous';

  // Protect /admin/* routes — redirect to admin login if not admin
  if (pathname.startsWith('/admin')) {
    // Allow access to admin login page
    if (pathname === '/admin/login') {
      // If already logged in as admin, redirect to dashboard
      if (token && userType === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      const response = NextResponse.next();
      setVisibilityHeaders(response, userVisibility, userId, userType);
      return response;
    }

    // All other admin routes require admin auth
    if (!token || userType !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
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

  // For all requests: set visibility headers
  const response = NextResponse.next();
  setVisibilityHeaders(response, userVisibility, userId, userType);
  return response;
}

function setVisibilityHeaders(
  response: NextResponse,
  visibility: number,
  userId: string,
  userType: string,
) {
  response.headers.set('x-user-visibility', String(visibility));
  response.headers.set('x-user-id', userId);
  response.headers.set('x-user-type', userType);
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
};
