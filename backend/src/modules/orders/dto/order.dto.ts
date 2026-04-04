import { IsUUID, IsNumber, IsArray, ValidateNested, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethodEnum {
  CASH = 'CASH',
  MTN = 'MTN',
  AIRTEL = 'AIRTEL',
}

export class CreateOrderItemDto {
  @IsUUID()
  menu_item_id: string;

  @IsNumber()
  quantity: number;
}

export class CreateOrderDto {
  @IsUUID()
  tenant_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  // Optional: Frontend cart totals as fallback if menu item prices are 0
  @IsNumber()
  @IsOptional()
  subtotal?: number;

  @IsNumber()
  @IsOptional()
  platform_fee?: number;

  @IsNumber()
  @IsOptional()
  total_amount?: number;

  // Optional: Table ID for dine-in orders from table QR codes
  @IsUUID()
  @IsOptional()
  table_id?: string;

  // Optional: Table number for dine-in orders
  @IsNumber()
  @IsOptional()
  table_number?: number;

  // Payment method: CASH or MOBILE_MONEY
  @IsEnum(PaymentMethodEnum)
  @IsOptional()
  payment_method?: PaymentMethodEnum;

  // Customer phone for mobile money payments
  @IsString()
  @IsOptional()
  customer_phone?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(['CREATED', 'PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED'])
  status: string;
}
