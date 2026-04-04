import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

/**
 * Admin roles hierarchy for future extensibility
 *
 * Currently implemented: PLATFORM_ADMIN (full access)
 *
 * Future role levels:
 * - SUPER_ADMIN: Full access (planned)
 * - OPERATIONS_ADMIN: Restaurants, orders, support, verification (planned)
 * - FINANCE_ADMIN: Payments, settlements, reports, ledger (planned)
 * - SUPPORT_ADMIN: Restaurants view, orders view, support issues, investigation (planned)
 * - READ_ONLY_ADMIN: View-only access (planned)
 */
export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPERATIONS_ADMIN = 'OPERATIONS_ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  SUPPORT_ADMIN = 'SUPPORT_ADMIN',
  READ_ONLY_ADMIN = 'READ_ONLY_ADMIN',
}

/**
 * RoleBasedAdminGuard - Protect routes by admin role level
 *
 * Currently enforces PLATFORM_ADMIN as the only admin level.
 * Future: Will implement granular admin roles
 *
 * Usage:
 * @UseGuards(RoleBasedAdminGuard)
 * @RequireAdminRole([AdminRole.FINANCE_ADMIN, AdminRole.SUPER_ADMIN])
 * async manageSettlements() { ... }
 */
@Injectable()
export class RoleBasedAdminGuard implements CanActivate {

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    // For now, only PLATFORM_ADMIN is allowed
    // Future: Check decorator for required admin roles
    if (!user || user.role !== UserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}

/**
 * Decorator for future admin role-based access control
 *
 * Usage when implemented:
 * @RequireAdminRole([AdminRole.OPERATIONS_ADMIN])
 * async getRestaurants() { ... }
 */
export const RequireAdminRole = () => {
  return (_target: any, _key?: any, _descriptor?: any) => {
    // Implementation pending when admin roles are added to user entity
  };
};
