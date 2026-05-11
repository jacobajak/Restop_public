import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
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
import { PlatformFeeSettlement } from './entities/platform-fee-settlement.entity';
import { AdminWallet, AdminLedger, PlatformFeeCollectionDaily, TenantFeeBreakdown } from './entities/admin-wallet.entity';
import { Order } from '../orders/entities/order.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { PaymentController } from './controllers/payment.controller';
import { RefundController } from './controllers/refund.controller';
import { ReceiptController } from './controllers/receipt.controller';
import { SettlementController } from './controllers/settlement.controller';
import { MerchantVerificationController } from './controllers/merchant-verification.controller';
import { JobMonitoringController } from './controllers/job-monitoring.controller';
import { AdminPlatformFeeSettlementsController } from './controllers/admin-platform-fee-settlements.controller';
import { TenantFeeAnalyticsController } from './controllers/tenant-fee-analytics.controller';
import { PaymentRealtimeMonitoringController } from './controllers/realtime-monitoring.controller';
import { AdminWalletController } from './controllers/admin-wallet.controller';
import { GuestCustomerTrackingController } from './controllers/guest-customer-tracking.controller';
import { FinancialAnalyticsController } from './controllers/financial-analytics.controller';
import { PaymentWebhookController } from './controllers/payment-webhook.controller';
import { PaymentService } from './services/payment.service';
import { WebhookService } from './services/webhook.service';
import { PayoutService } from './services/payout.service';
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
import { PlatformFeeSettlementService } from './services/platform-fee-settlement.service';
import { AdminWalletService } from './services/admin-wallet.service';
import { MerchantVerificationService } from './services/merchant-verification.service';
import { PaymentSchedulerService } from './services/payment-scheduler.service';
import { PayoutRetryService } from './services/payout-retry.service';
import { WebhookVerificationService } from './services/webhook-verification.service';
import { JobMonitoringService } from './services/job-monitoring.service';
import { TenantPaymentAccountService } from './services/tenant-payment-account-management.service';
import { FlutterwaveSubaccountService } from './services/flutterwave-subaccount.service';
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
import { ProcessPlatformFeeSettlementsJob } from './jobs/process-platform-fee-settlements.job';
import { CleanupExpiredIdempotencyKeysJob } from './jobs/cleanup-expired-idempotency-keys.job';
import { IdempotencyMiddleware } from './middleware/idempotency.middleware';
// Resilience Pattern Services
import { HealthCheckService } from './services/health-check.service';
import { RetryStrategyService } from './services/retry-strategy.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { PaymentRecoveryService } from './services/payment-recovery.service';
import { GracefulDegradationService } from './services/graceful-degradation.service';
// Real-Time Payment Updates (Phase 5)
import { PaymentRealtimeGateway } from './gateways/payment-realtime.gateway';
import { PaymentRealtimeService } from './services/payment-realtime.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
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
      PlatformFeeSettlement,
      AdminWallet,
      AdminLedger,
      PlatformFeeCollectionDaily,
      TenantFeeBreakdown,
      Order,
      Tenant,
    ]),
    ConfigModule,
    NotificationsModule,
    AuditModule,
    CommonModule,
  ],
  controllers: [
    PaymentController,
    PaymentWebhookController,
    RefundController,
    ReceiptController,
    SettlementController,
    MerchantVerificationController,
    JobMonitoringController,
    AdminPlatformFeeSettlementsController,
    TenantFeeAnalyticsController,
    PaymentRealtimeMonitoringController,
    AdminWalletController,
    GuestCustomerTrackingController,
    FinancialAnalyticsController,
  ],
  providers: [
    PaymentService,
    WebhookService,
    PayoutService,
    CommissionService,
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
    PlatformFeeSettlementService,
    AdminWalletService,
    MerchantVerificationService,
    PaymentSchedulerService,
    PayoutRetryService,
    WebhookVerificationService,
    JobMonitoringService,
    TenantPaymentAccountService,
    FlutterwaveSubaccountService,
    // Phase 3: Error Recovery & Retry Logic
    IdempotencyService,
    WebhookEventService,
    ResilientExternalServicesManager,
    GracefulDegradationHandler,
    // Resilience Pattern Services
    HealthCheckService,
    RetryStrategyService,
    CircuitBreakerService,
    PaymentRecoveryService,
    GracefulDegradationService,
    // Phase 5: Real-Time Payment Updates
    PaymentRealtimeGateway,
    PaymentRealtimeService,
    // Background Jobs
    PaymentVerificationJob,
    MerchantPayablesJob,
    SettlementProcessingJob,
    SettlementRetryJob,
    ReconciliationJob,
    MerchantSummaryJob,
    PaymentRetryJob,
    ProcessPlatformFeeSettlementsJob,
    CleanupExpiredIdempotencyKeysJob,
  ],
  exports: [
    PaymentService,
    WebhookService,
    PayoutService,
    CommissionService,
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
    PlatformFeeSettlementService,
    AdminWalletService,
    MerchantVerificationService,
    PaymentSchedulerService,
    PayoutRetryService,
    WebhookVerificationService,
    JobMonitoringService,
    TenantPaymentAccountService,
    // Phase 3: Error Recovery & Retry Logic
    IdempotencyService,
    WebhookEventService,
    ResilientExternalServicesManager,
    GracefulDegradationHandler,
    // Resilience Pattern Services
    HealthCheckService,
    RetryStrategyService,
    CircuitBreakerService,
    PaymentRecoveryService,
    GracefulDegradationService,
    // Phase 5: Real-Time Payment Updates
    PaymentRealtimeGateway,
    PaymentRealtimeService,
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
export class PaymentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply idempotency middleware to payment endpoints
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(
        { path: 'orders/*/pay', method: RequestMethod.POST },
        { path: 'orders/*/mark-paid', method: RequestMethod.PATCH },
        { path: 'webhooks/flutterwave', method: RequestMethod.POST },
        { path: 'cashout', method: RequestMethod.POST },
        { path: 'refund', method: RequestMethod.POST },
      );
  }
}

