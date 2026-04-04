import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { JwtPayload } from '../strategies/jwt.strategy';

/**
 * GetTenant decorator
 * 
 * Extracts the tenant ID from the JWT payload.
 * Throws BadRequestException if no tenant ID is present (user not allocated to a tenant).
 * 
 * Usage:
 * @Get(':id')
 * async getItem(@GetTenant() tenantId: string) { ... }
 */
export const GetTenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user || !user.tenantId) {
      throw new BadRequestException('Tenant ID not found in JWT payload');
    }

    return user.tenantId;
  },
);
