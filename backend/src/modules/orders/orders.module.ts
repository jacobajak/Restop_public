import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MerchantSettlementsController } from './controllers/merchant-settlements.controller';
import { SupportIssuesController } from './controllers/support-issues.controller';
import { RefundsController } from './controllers/refunds.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { CommonModule } from '../../common/common.module';
import { Payout } from '../payments/entities/payout.entity';
import { SupportIssue } from '../admin/entities/support-issue.entity';
import { Refund } from '../payments/entities/refund.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, MenuItem, Payout, SupportIssue, Refund]), 
    NotificationsModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => AdminModule),
    CommonModule,
    TenantsModule,
  ],
  controllers: [OrdersController, MerchantSettlementsController, SupportIssuesController, RefundsController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
