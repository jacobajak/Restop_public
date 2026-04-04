import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentTransaction } from './entities/payment.entity';
import { TenantPaymentAccount } from './entities/tenant-payment-account.entity';
import { Commission } from './entities/commission.entity';
import { Payout } from './entities/payout.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { Refund } from './entities/refund.entity';
import { TenantPaymentConfig } from './entities/tenant-payment-config.entity';
import { TenantWallet, LedgerEntry } from './entities/wallet.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { ProviderWebhookEvent } from './entities/provider-webhook-event.entity';
import { FraudReview } from './entities/fraud-review.entity';
import { Order } from '../orders/entities/order.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { PaymentController } from './controllers/payment.controller';
import { SettlementController } from './controllers/settlement.controller';
import { MerchantVerificationController } from './controllers/merchant-verification.controller';
import { JobMonitoringController } from './controllers/job-monitoring.controller';
import { PaymentService } from './services/payment.service';
import { WebhookService } from './services/webhook.service';
import { PayoutService } from './services/payout.service';
import { PaypackIntegrationService } from './services/paypack-integration.service';
import { FlutterwaveIntegrationService } from './services/flutterwave-integration.service';
import { CommissionService } from './services/commission.service';
import { TransactionVerificationService } from './services/transaction-verification.service';
import { PaymentEventService } from './services/payment-event.service';
import { WalletService } from './services/wallet.service';
import { TenantPaymentConfigService } from './services/tenant-payment-config.service';
import { RefundService } from './services/refund.service';
import { PaymentRetryService } from './services/payment-retry.service';
import { ReconciliationService } from './services/reconciliation.service';
import { FinancialReportingService } from './services/financial-reporting.service';
import { FraudDetectionService } from './services/fraud-detection.service';
import { FraudReviewService } from './services/fraud-review.service';
import { GuestCustomerTrackingService } from './services/guest-customer-tracking.service';
import { PaymentStatusService } from './services/payment-status.service';
import { ReceiptService } from './services/receipt.service';
import { FailureCommunicationService } from './services/failure-communication.service';
import { SettlementService } from './services/settlement.service';
import { MerchantVerificationService } from './services/merchant-verification.service';
import { PaymentSchedulerService } from './services/payment-scheduler.service';
import { PayoutRetryService } from './services/payout-retry.service';
import { WebhookVerificationService } from './services/webhook-verification.service';
import { JobMonitoringService } from './services/job-monitoring.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { PaymentVerificationJob } from './jobs/verify-pending-payments.job';
import { MerchantPayablesJob } from './jobs/create-merchant-payables.job';
import { SettlementProcessingJob } from './jobs/process-settlements.job';
import { SettlementRetryJob } from './jobs/retry-failed-settlements.job';
import { ReconciliationJob } from './jobs/daily-reconciliation.job';
import { MerchantSummaryJob } from './jobs/merchant-summary.job';
import { IdempotencyService } from './services/idempotency.service';
import { WebhookEventService } from './services/webhook-event.service';
import { ResilientExternalServicesManager } from './services/resilient-external-services.manager';
import { GracefulDegradationHandler } from './services/graceful-degradation.handler';
import { PaymentRetryJob } from './jobs/payment-retry.job';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      PaymentTransaction,
      TenantPaymentAccount,
      Commission,
      Payout,
      PaymentEvent,
      Refund,
      TenantPaymentConfig,
      TenantWallet,
      LedgerEntry,
      IdempotencyKey,
      ProviderWebhookEvent,
      FraudReview,
      Order,
      Tenant,
    ]),
    ConfigModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [PaymentController, SettlementController, MerchantVerificationController, JobMonitoringController],
  providers: [
    PaymentService,
    WebhookService,
    PayoutService,
    CommissionService,
    PaypackIntegrationService,
    FlutterwaveIntegrationService,
    TransactionVerificationService,
    PaymentEventService,
    WalletService,
    TenantPaymentConfigService,
    RefundService,
    PaymentRetryService,
    ReconciliationService,
    FinancialReportingService,
    FraudDetectionService,
    FraudReviewService,
    GuestCustomerTrackingService,
    PaymentStatusService,
    ReceiptService,
    FailureCommunicationService,
    SettlementService,
    MerchantVerificationService,
    PaymentSchedulerService,
    PayoutRetryService,
    WebhookVerificationService,
    JobMonitoringService,
    // Phase 3: Error Recovery & Retry Logic
    IdempotencyService,
    WebhookEventService,
    ResilientExternalServicesManager,
    GracefulDegradationHandler,
    // Background Jobs
    PaymentVerificationJob,
    MerchantPayablesJob,
    SettlementProcessingJob,
    SettlementRetryJob,
    ReconciliationJob,
    MerchantSummaryJob,
    PaymentRetryJob,
  ],
  exports: [
    PaymentService,
    WebhookService,
    PayoutService,
    CommissionService,
    PaypackIntegrationService,
    FlutterwaveIntegrationService,
    TransactionVerificationService,
    PaymentEventService,
    WalletService,
    TenantPaymentConfigService,
    RefundService,
    PaymentRetryService,
    ReconciliationService,
    FinancialReportingService,
    FraudDetectionService,
    FraudReviewService,
    GuestCustomerTrackingService,
    PaymentStatusService,
    ReceiptService,
    FailureCommunicationService,
    SettlementService,
    MerchantVerificationService,
    PaymentSchedulerService,
    PayoutRetryService,
    WebhookVerificationService,
    JobMonitoringService,
    // Phase 3: Error Recovery & Retry Logic
    IdempotencyService,
    WebhookEventService,
    ResilientExternalServicesManager,
    GracefulDegradationHandler,
    // Background Jobs
    PaymentVerificationJob,
    MerchantPayablesJob,
    SettlementProcessingJob,
    SettlementRetryJob,
    ReconciliationJob,
    MerchantSummaryJob,
    PaymentRetryJob,
  ],
})
export class PaymentsModule {}

