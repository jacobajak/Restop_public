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
    console.log('[MIDDLEWARE] Token detected on auth page, checking user role');
    
    // Parse JWT payload to get user role (without verification, just decode)
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const userRole = payload.role;
        console.log('[MIDDLEWARE] User role:', userRole);
        
        // Redirect to dashboard for tenants, admin to admin overview
        const redirectUrl = userRole === 'PLATFORM_ADMIN' ? '/admin/overview' : '/dashboard';
        console.log('[MIDDLEWARE] Redirecting to:', redirectUrl);
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    } catch (e) {
      console.error('[MIDDLEWARE] Failed to decode token:', e);
      // Fall back to dashboard if token decode fails
    }
    
    // Default fallback
    console.log('[MIDDLEWARE] Defaulting to dashboard');
    return NextResponse.redirect(new URL('/dashboard', request.url));
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
