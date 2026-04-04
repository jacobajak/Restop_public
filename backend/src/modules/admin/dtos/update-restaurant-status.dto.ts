import { IsNotEmpty, IsEnum, IsOptional, MinLength } from 'class-validator';

export enum RestaurantStatusEnum {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

/**
 * DTO for updating restaurant status
 * 
 * Used by AdminRestaurantsController to validate suspension/activation requests
 */
export class UpdateRestaurantStatusDto {
  @IsEnum(RestaurantStatusEnum, {
    message: 'Status must be one of: ACTIVE, SUSPENDED, PENDING',
  })
  @IsNotEmpty()
  status: RestaurantStatusEnum;

  @IsOptional()
  @MinLength(5, {
    message: 'Suspension reason must be at least 5 characters',
  })
  reason?: string;
}
