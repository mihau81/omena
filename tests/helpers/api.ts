import { NextRequest } from 'next/server';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Creates a mock NextRequest for testing route handlers.
 */
export function createRequest(
  method: HttpMethod,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3002${url}`;

  const requestInit: RequestInit & { signal?: AbortSignal } = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(fullUrl, requestInit);
}

/**
 * Calls a Next.js route handler and returns the parsed response.
 */
export async function callRouteHandler(
  handler: (req: NextRequest, context?: unknown) => Promise<Response>,
  request: NextRequest,
  context?: unknown,
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const response = await handler(request, context);
  const contentType = response.headers.get('content-type') ?? '';
  let data: unknown;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

/**
 * Creates an authenticated request with a Bearer token.
 */
export function createAuthenticatedRequest(
  method: HttpMethod,
  url: string,
  token: string,
  body?: unknown,
): NextRequest {
  return createRequest(method, url, body, {
    Authorization: `Bearer ${token}`,
  });
}
