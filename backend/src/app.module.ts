import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from '@hapi/joi';

import { TenantsModule } from './modules/tenants/tenants.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { TablesModule } from './modules/tables/tables.module';
import { AdminModule } from './modules/admin/admin.module';
import { CommonModule } from './common/common.module';

// Import all entities explicitly
import { User } from './modules/users/entities/user.entity';
import { StaffMember } from './modules/users/entities/staff-member.entity';
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { Order } from './modules/orders/entities/order.entity';
import { OrderItem } from './modules/orders/entities/order-item.entity';
import { MenuItem } from './modules/menu/entities/menu-item.entity';
import { MenuCategory } from './modules/menu/entities/menu-category.entity';
import { PaymentTransaction } from './modules/payments/entities/payment.entity';
import { PaymentEvent } from './modules/payments/entities/payment-event.entity';
import { Payout } from './modules/payments/entities/payout.entity';
import { Commission } from './modules/payments/entities/commission.entity';
import { TenantWallet } from './modules/payments/entities/wallet.entity';
import { TenantPaymentConfig } from './modules/payments/entities/tenant-payment-config.entity';
import { TenantPaymentAccount } from './modules/payments/entities/tenant-payment-account.entity';
import { Refund } from './modules/payments/entities/refund.entity';
import { Table } from './modules/tables/entities/table.entity';
import { AuditLog } from './modules/admin/entities/audit-log.entity';
import { SupportIssue } from './modules/admin/entities/support-issue.entity';
import { PlatformSettings } from './modules/admin/entities/platform-settings.entity';
import { OtpChallenge, LoginAttempt } from './modules/auth/entities/otp-challenge.entity';

/**
 * Root Module (AppModule)
 * 
 * Configures the entire NestJS application with:
 * - Global environment configuration management
 * - Database connection (PostgreSQL via TypeORM)
 * - All feature modules (Auth, Users, Tenants, Orders, Menu, Payments, Notifications, Analytics)
 * 
 * Environment variables are validated against Joi schema to ensure:
 * - All required variables are present
 * - Variables have correct types and allowed values
 * - Defaults are properly set for optional variables
 * 
 * Database setup:
 * - Auto-migrations run on startup (when migrationsRun: true)
 * - Entities are auto-discovered from '*.entity.ts' files
 * - Schema synchronization in development mode only
 * 
 * @module AppModule
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('7d'),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        FRONTEND_URL: Joi.string().default('http://localhost:3000'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [
          User,
          StaffMember,
          Tenant,
          Order,
          OrderItem,
          MenuItem,
          MenuCategory,
          PaymentTransaction,
          PaymentEvent,
          Payout,
          Commission,
          TenantWallet,
          TenantPaymentConfig,
          TenantPaymentAccount,
          Refund,
          Table,
          AuditLog,
          SupportIssue,
          PlatformSettings,
          OtpChallenge,
          LoginAttempt,
        ],
        migrations: [__dirname + '/database/migrations/**/*{.ts,.js}'],
        migrationsRun: true,
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),
    TenantsModule,
    MenuModule,
    OrdersModule,
    PaymentsModule,
    UsersModule,
    AuthModule,
    NotificationsModule,
    AnalyticsModule,
    TablesModule,
    AdminModule,
    CommonModule,  ],
})
export class AppModule {}
