import { IsEmail, IsNotEmpty, MinLength, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsNotEmpty()
  tenant_name?: string; // Required if role is TENANT_OWNER

  @IsOptional()
  @IsNotEmpty()
  tenant_slug?: string; // Required if role is TENANT_OWNER
}
