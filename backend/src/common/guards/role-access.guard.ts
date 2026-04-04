import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

/**
 * Guard to check if user has MANAGER or higher role
 */
@Injectable()
export class ManagerOrHigherGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return [UserRole.TENANT_OWNER, UserRole.TENANT_MANAGER].includes(user?.role);
  }
}

/**
 * Guard to allow kitchen staff and higher
 */
@Injectable()
export class KitchenStaffOrHigherGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return [
      UserRole.TENANT_OWNER,
      UserRole.TENANT_MANAGER,
      UserRole.KITCHEN_STAFF,
    ].includes(user?.role);
  }
}

/**
 * Guard to allow only tenant owner
 */
@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return user?.role === UserRole.TENANT_OWNER;
  }
}

/**
 * Guard to check if user can manage tenants (platform admin or owner)
 */
@Injectable()
export class TenantAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return [
      UserRole.PLATFORM_ADMIN,
      UserRole.TENANT_OWNER,
    ].includes(user?.role);
  }
}
