import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES = {
  dashboard: '/dashboard',
  admin: '/admin',
  orders: '/orders',
};

const PUBLIC_ROUTES = {
  login: '/auth/login',
  register: '/auth/register',
  menu: '/menu',
};

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('token')?.value;
  
  console.log('[MIDDLEWARE] Request:', pathname, 'Token:', !!token);
  
  const isPublicRoute =
    pathname === PUBLIC_ROUTES.login ||
    pathname === PUBLIC_ROUTES.register ||
    pathname.startsWith(PUBLIC_ROUTES.menu) ||
    pathname === '/' ||
    pathname.startsWith('/api/public');

  const isProtectedRoute =
    pathname.startsWith(PROTECTED_ROUTES.dashboard) ||
    pathname.startsWith(PROTECTED_ROUTES.admin) ||
    pathname.startsWith(PROTECTED_ROUTES.orders);

  console.log('[MIDDLEWARE] isPublic:', isPublicRoute, 'isProtected:', isProtectedRoute);

  // If no token and trying to access protected route, redirect to login
  if (isProtectedRoute && !token) {
    console.log('[MIDDLEWARE] Redirecting to login (protected + no token)');
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // If token exists and trying to access auth routes, redirect based on user role
  if (token && (pathname === PUBLIC_ROUTES.login || pathname === PUBLIC_ROUTES.register)) {
    console.log('[MIDDLEWARE] Token detected on auth page, determining redirect URL');
    
    let redirectUrl = '/dashboard'; // Default fallback
    
    // Try to decode JWT payload to get user role
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const userRole = payload.role;
        console.log('[MIDDLEWARE] User role from JWT:', userRole);
        
        if (userRole === 'PLATFORM_ADMIN') {
          redirectUrl = '/admin/overview';
        }
      }
    } catch (e) {
      console.warn('[MIDDLEWARE] Failed to decode JWT token, checking request headers or using default');
    }
    
    console.log('[MIDDLEWARE] Redirecting authenticated user to:', redirectUrl);
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // Allow access to public routes
  if (isPublicRoute) {
    console.log('[MIDDLEWARE] Allowing public route');
    return NextResponse.next();
  }

  console.log('[MIDDLEWARE] Default allow');
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
