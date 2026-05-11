import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SupportIssue } from './entities/support-issue.entity';
import { PlatformSettings } from './entities/platform-settings.entity';
import { Order } from '../orders/entities/order.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { PaymentTransaction } from '../payments/entities/payment.entity';
import { Refund } from '../payments/entities/refund.entity';
import { FraudReview } from '../payments/entities/fraud-review.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { SupportIssueService } from './services/support-issue.service';
import { PlatformSettingsService } from './services/platform-settings.service';
import { AdminPaymentManagementService } from './services/admin-payment-management.service';
import { AdminAuditLogsController } from './controllers/admin-audit-logs.controller';
import { AdminSupportController } from './controllers/admin-support.controller';
import { AdminVerificationController } from './controllers/admin-verification.controller';
import { AdminOverviewController } from './controllers/admin-overview.controller';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { AdminHealthController } from './controllers/admin-health.controller';
import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { AdminRefundsController } from './controllers/admin-refunds.controller';
import { AdminFraudController } from './controllers/admin-fraud.controller';
import { AdminRestaurantsController } from './controllers/admin-restaurants.controller';
import { AdminSettlementsController } from './controllers/admin-settlements.controller';
import { SupportIssueEscalationJob } from './jobs/support-issue-escalation.job';
import { TenantsModule } from '../tenants/tenants.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

/**
 * AdminModule - Platform administration layer
 *
 * Provides:
 * 1. Audit logging service for tracking sensitive actions
 * 2. Support issue tracking system
 * 3. Platform settings management
 * 4. Future: Admin controllers for dashboard, restaurants, orders, payments, settlements
 *
 * Phase 1 Implementation (Auth & Infrastructure):
 * ✅ AuditLog entity for comprehensive action tracking
 * ✅ SupportIssue entity for operational problem tracking
 * ✅ PlatformSettings entity for configuration management
 * ✅ AdminGuard for PLATFORM_ADMIN role protection
 * ✅ RoleBasedAdminGuard for future role hierarchy
 * ✅ AuditService for logging platform actions
 * ✅ SupportIssueService for issue management
 * ✅ PlatformSettingsService for settings management
 *
 * Phase 2 Implementation (Core Data Entities):
 * ✅ AdminOverviewController
 * ✅ AdminRestaurantsController
 * ✅ AdminOrdersController
 * ✅ AdminPaymentsController
 * ✅ AdminRefundsController
 * ✅ AdminSettlementsController
 * ✅ AdminAuditLogsController
 *
 * Phase 3+ Implementation:
 * ⏳ Additional controllers and services as needed
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SupportIssue, PlatformSettings, Order, Tenant, PaymentTransaction, Refund, FraudReview, AuditLog]),
    ScheduleModule.forRoot(),
    AuditModule,
    TenantsModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => PaymentsModule),
    NotificationsModule,
  ],
  controllers: [
    AdminAuditLogsController,
    AdminSupportController,
    AdminVerificationController,
    AdminOverviewController,
    AdminOrdersController,
    AdminHealthController,
    AdminPaymentsController,
    AdminRefundsController,
    AdminFraudController,
    AdminRestaurantsController,
    AdminSettlementsController,
  ],
  providers: [
    SupportIssueService,
    PlatformSettingsService,
    SupportIssueEscalationJob,
    AdminPaymentManagementService,
  ],
  exports: [AuditModule, SupportIssueService, PlatformSettingsService, AdminPaymentManagementService],
})
export class AdminModule implements OnModuleInit {
  constructor(private platformSettingsService: PlatformSettingsService) {}

  /**
   * Initialize platform settings cache on module startup
   */
  async onModuleInit() {
    try {
      await this.platformSettingsService.initializeCache();
      console.log('[AdminModule] Platform settings cache initialized');
    } catch (error) {
      console.warn('[AdminModule] Could not initialize platform settings cache:', error.message);
      // Non-fatal - settings can be initialized on first use
    }
  }
}
