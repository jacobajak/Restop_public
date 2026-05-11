import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  Min,
  Max,
  MinLength,
} from 'class-validator';

/**
 * DTOs for Admin Payment Management Operations
 */

/**
 * Create manual payment for testing
 */
export class CreateManualPaymentDto {
  @IsUUID()
  order_id: string;

  @IsUUID()
  tenant_id: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  currency: string; // e.g., KES, RWF, TZS

  @IsEnum(['MTN', 'AIRTEL', 'CASH'])
  method: 'MTN' | 'AIRTEL' | 'CASH';

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Override payment status
 */
export class OverridePaymentStatusDto {
  @IsEnum(['SUCCESSFUL', 'FAILED', 'PENDING', 'CANCELLED'])
  new_status: 'SUCCESSFUL' | 'FAILED' | 'PENDING' | 'CANCELLED';

  @IsString()
  @MinLength(10)
  reason: string;
}

/**
 * Bulk process refunds
 */
export class BulkProcessRefundsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  refund_ids: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Bulk reject refunds
 */
export class BulkRejectRefundsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  refund_ids: string[];

  @IsString()
  @MinLength(10)
  rejection_reason: string;
}

/**
 * Approve fraud review
 */
export class ApproveFraudReviewDto {
  @IsEnum(['ALLOW', 'HOLD_24H', 'BLOCK_CUSTOMER', 'ESCALATE'])
  action: 'ALLOW' | 'HOLD_24H' | 'BLOCK_CUSTOMER' | 'ESCALATE';

  @IsString()
  @MinLength(10)
  notes: string;
}

/**
 * Dismiss fraud review
 */
export class DismissFraudReviewDto {
  @IsString()
  @MinLength(10)
  reason: string;
}

/**
 * Bulk fraud review action
 */
export class BulkFraudReviewActionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  review_ids: string[];

  @IsEnum(['APPROVE', 'DISMISS', 'ESCALATE'])
  action: string;

  @IsString()
  @MinLength(10)
  reason: string;
}

/**
 * Reassign fraud review
 */
export class ReassignFraudReviewDto {
  @IsUUID()
  admin_id: string;
}

/**
 * Query filter for refunds
 */
export class RefundFilterDto {
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'PROCESSED', 'FAILED', 'REJECTED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @IsOptional()
  @IsUUID()
  order_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_amount?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

/**
 * Query filter for fraud reviews
 */
export class FraudReviewFilterDto {
  @IsOptional()
  @IsEnum(['OPEN', 'UNDER_REVIEW', 'APPROVED', 'BLOCKED', 'DISMISSED', 'ESCALATED'])
  status?: string;

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  risk_level?: string;

  @IsOptional()
  @IsEnum(['ORDER', 'CUSTOMER', 'PAYMENT', 'REFUND', 'MERCHANT'])
  subject_type?: string;

  @IsOptional()
  @IsUUID()
  assigned_admin_id?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

/**
 * Query filter for payments
 */
export class PaymentFilterDto {
  @IsOptional()
  @IsEnum(['MTN', 'AIRTEL', 'CASH'])
  method?: string;

  @IsOptional()
  @IsEnum(['INITIATED', 'PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  restaurant_id?: string;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
