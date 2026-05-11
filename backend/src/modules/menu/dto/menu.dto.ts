import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateMenuItemDto {
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @IsString()
  @IsOptional()
  category?: string; // Accept category name as string, will be resolved to category_id

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  currency?: string; // Optional currency code (ISO 4217), inherits from tenant if not provided

  @IsString()
  @IsOptional()
  image_url?: string;

  @IsBoolean()
  @IsOptional()
  is_available?: boolean;
}

export class UpdateMenuItemDto {
  @IsString()
  @IsOptional()
  name: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsNumber()
  @IsOptional()
  price: number;

  @IsString()
  @IsOptional()
  currency?: string; // Optional currency code (ISO 4217)

  @IsString()
  @IsOptional()
  image_url: string;

  @IsBoolean()
  @IsOptional()
  is_available: boolean;
}

export class CreateMenuCategoryDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsNumber()
  @IsOptional()
  sort_order: number;
}
