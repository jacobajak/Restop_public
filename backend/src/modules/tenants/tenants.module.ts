import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './services/tenants.service';
import { TenantPaymentAccountService } from './services/tenant-payment-account.service';
import { QrCodeService } from './services/qrcode.service';
import { TenantsController } from './tenants.controller';
import { TenantPaymentAccount } from '../payments/entities/tenant-payment-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantPaymentAccount])],
  controllers: [TenantsController],
  providers: [TenantsService, TenantPaymentAccountService, QrCodeService],
  exports: [TenantsService, TenantPaymentAccountService, QrCodeService, TypeOrmModule],
})
export class TenantsModule {}
