import { IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO for creating a new table
 */
export class CreateTableDto {
  @IsNumber()
  table_number: number;

  @IsString()
  @IsOptional()
  qr_code?: string; // Auto-generated if not provided

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

/**
 * DTO for updating a table
 */
export class UpdateTableDto {
  @IsNumber()
  @IsOptional()
  table_number?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

/**
 * DTO for table response
 */
export class TableDto {
  id: string;
  table_number: number;
  qr_code: string;
  qr_url: string;
  is_active: boolean;
  created_at: Date;
}
