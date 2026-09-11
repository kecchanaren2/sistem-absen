import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CORS middleware
export function middleware(request: NextRequest) {
  // Allow requests from same origin and common localhost ports
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    // Add your production domain here
    // 'https://yourdomain.com',
  ];

  const isAllowedOrigin = allowedOrigins.includes(origin || '');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin || '*' : '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Add CORS headers to all responses
  const response = NextResponse.next();
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return response;
}

// Configure which routes should have CORS
export const config = {
  matcher: '/api/:path*',
};
