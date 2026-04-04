import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Check if user has a tenant_id
    if (!request.user || !request.user.tenant_id) {
      throw new BadRequestException(
        'TENANT_STAFF or TENANT_OWNER role required. This endpoint is for restaurant staff only.',
      );
    }

    return true;
  }
}
