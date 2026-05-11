import { SupportIssueSeverityEnum, SupportIssueTypeEnum } from '../entities/support-issue.entity';

/**
 * DTO for creating a support issue from tenant/customer side
 * Used when tenants or customers report technical errors
 */
export class CreateSupportIssueFromTenantDto {
  /**
   * Type of issue being reported
   * PAYMENT_ISSUE, SETTLEMENT_ISSUE, ORDER_ISSUE, VERIFICATION_ISSUE, SYNC_ISSUE, SYSTEM_ISSUE, OTHER
   */
  issue_type: SupportIssueTypeEnum;

  /**
   * Severity level of the issue
   * LOW, MEDIUM, HIGH, CRITICAL
   * Default: MEDIUM
   */
  severity?: SupportIssueSeverityEnum;

  /**
   * Brief subject/title of the issue
   * Example: "Orders not syncing to dashboard"
   */
  subject: string;

  /**
   * Detailed description of the problem
   * What happened, when it happened, what's affected
   * Example: "When I place an order, it doesn't appear in my dashboard for 10+ minutes"
   */
  description: string;

  /**
   * Error code or screenshot data (optional)
   * Can include error messages from the UI
   */
  error_details?: string;

  /**
   * Related order ID if issue is order-specific (optional)
   */
  related_order_id?: string;

  /**
   * Related payment transaction ID if issue is payment-related (optional)
   */
  related_payment_id?: string;

  /**
   * Related settlement ID if issue is settlement-related (optional)
   */
  related_settlement_id?: string;
}

/**
 * DTO for creating a support issue from customer/end-user side
 * Customers can report issues they encounter while using the platform
 */
export class CreateSupportIssueFromCustomerDto {
  /**
   * Type of issue being reported
   */
  issue_type: SupportIssueTypeEnum;

  /**
   * Severity level - customers typically can't set CRITICAL
   */
  severity?: SupportIssueSeverityEnum;

  /**
   * What issue did the customer encounter?
   */
  subject: string;

  /**
   * Detailed description
   */
  description: string;

  /**
   * Error messages or detailed error info
   */
  error_details?: string;

  /**
   * Which order is affected (if order-related)
   */
  related_order_id?: string;
}
