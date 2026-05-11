import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './services/tenants.service';
import { TenantPaymentAccountService } from './services/tenant-payment-account.service';
import { QrCodeService } from './services/qrcode.service';
import { TenantsController } from './tenants.controller';
import { CurrencySettingsController } from './controllers/currency-settings.controller';
import { TenantPaymentAccount } from '../payments/entities/tenant-payment-account.entity';
import { SupportIssueService } from '../admin/services/support-issue.service';
import { SupportIssue } from '../admin/entities/support-issue.entity';
import { AuditService } from '../audit/services/audit.service';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, TenantPaymentAccount, SupportIssue, AuditLog]),
    NotificationsModule,
    CommonModule,
  ],
  controllers: [TenantsController, CurrencySettingsController],
  providers: [TenantsService, TenantPaymentAccountService, QrCodeService, SupportIssueService, AuditService],
  exports: [TenantsService, TenantPaymentAccountService, QrCodeService, SupportIssueService, TypeOrmModule],
})
export class TenantsModule {}
