import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  tenant_id: string | null;
  role: string;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // This is used to extract the JWT and validate it
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext): any {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    // Check token format (Bearer scheme)
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid authorization header format. Expected: Bearer <token>');
    }

    // If JWT verification failed
    if (err) {
      throw new UnauthorizedException(`Authentication failed: ${err.message}`);
    }

    // If user is not present (token is invalid)
    if (!user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException(`Authentication failed: ${info?.message || 'Unknown error'}`);
    }

    // Validate required JWT payload fields
    // For PLATFORM_ADMIN users, tenantId can be null
    // For tenant-based users, both userId and tenantId are required
    if (!user.userId) {
      throw new UnauthorizedException('Invalid token payload. Missing userId');
    }
    
    // Allow null tenantId for PLATFORM_ADMIN role
    if (user.role !== 'PLATFORM_ADMIN' && !user.tenantId) {
      throw new UnauthorizedException('Invalid token payload. Missing tenantId for non-admin user');
    }

    // Transform JWT payload to include both camelCase (for backward compatibility)
    // and snake_case (for ORM entity field names)
    const transformedUser = {
      // Original camelCase for backward compatibility with existing decorators/controllers
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      // Snake_case versions for direct database field mapping
      id: user.userId,
      tenant_id: user.tenantId,
    };

    // Attach transformed user to request object
    (request as any).user = transformedUser;

    return transformedUser;
  }
}
