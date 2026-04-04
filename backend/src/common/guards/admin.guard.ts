import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

/**
 * AdminGuard - Protect routes that require PLATFORM_ADMIN role
 *
 * Checks if the authenticated user has PLATFORM_ADMIN role.
 *
 * Used for protecting admin-only endpoints like:
 * - Admin dashboard
 * - Restaurant management
 * - Payment monitoring
 * - Settlement controls
 * - Audit logs
 * - Platform settings
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, AdminGuard)
 * async getAdminDashboard() { ... }
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check for PLATFORM_ADMIN role
    if (user.role !== UserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException('PLATFORM_ADMIN access required');
    }

    return true;
  }
}
