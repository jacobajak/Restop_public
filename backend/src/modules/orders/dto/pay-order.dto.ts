import { IsEnum, IsString, IsOptional } from 'class-validator';

/**
 * PayOrderDto
 * 
 * Request body for POST /orders/{id}/pay endpoint
 * 
 * Spec: Step 2 — Select Payment Method
 * POST /orders/{id}/pay
 * {
 *   "payment_method": "MTN",
 *   "phone_number": "CUSTOMER_PHONE"
 * }
 */
export class PayOrderDto {
  @IsEnum(['CASH', 'MTN', 'AIRTEL'])
  payment_method: 'CASH' | 'MTN' | 'AIRTEL';

  @IsString()
  @IsOptional()
  phone_number?: string; // Required for MTN/AIRTEL, optional for CASH
}
