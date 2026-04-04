import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { JwtPayload } from '../../../common/strategies/jwt.strategy';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Payout, PayoutStatusEnum } from '../../payments/entities/payout.entity';
import { Order, PaymentStatusEnum } from '../entities/order.entity';
import { CacheService } from '../../../common/services/cache.service';

/**
 * MerchantSettlementsController
 *
 * Merchant-facing settlements and earnings endpoints
 * All endpoints scoped to authenticated merchant's tenant
 *
 * GET /merchant/settlements - Earnings summary
 * GET /merchant/settlements/history - Settlement history
 * GET /merchant/settlements/:id - Settlement details
 */
@Controller('merchant/settlements')
@UseGuards(JwtAuthGuard)
export class MerchantSettlementsController {
  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * GET /merchant/settlements
   * Get earnings summary for the merchant
   * Includes pending and completed payouts
   */
  @Get()
  async getSettlementsSummary(@GetUser() user: JwtPayload) {
    try {
      const tenantId = user.tenantId;
      const cacheKey = `settlement:${tenantId}:summary`;

      // Try cache first
      const cachedSummary = await this.cacheService.get(cacheKey);
      if (cachedSummary) {
        return {
          success: true,
          data: cachedSummary,
          cached: true,
        };
      }

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's orders
      const todaysOrders = await this.orderRepository
        .createQueryBuilder('order')
        .select('COUNT(order.id)', 'count')
        .addSelect('SUM(order.total_amount)', 'total_gmv')
        .where('order.tenant_id = :tenantId', { tenantId })
        .andWhere('order.payment_status = :status', { status: PaymentStatusEnum.PAID })
        .andWhere('order.created_at >= :today', { today })
        .andWhere('order.created_at < :tomorrow', { tomorrow })
        .getRawOne();

      const todaysGMV = parseInt(todaysOrders?.total_gmv || 0, 10);
      const todaysOrderCount = parseInt(todaysOrders?.count || 0, 10);

      // Calculate platform fees (3%)
      const platformFee = Math.round(todaysGMV * 0.03);
      const netEarnings = todaysGMV - platformFee;

      // Optimized: Get all payouts with aggregations in a single query
      const payoutAggregates = await this.payoutRepository
        .createQueryBuilder('payout')
        .select('payout.status', 'status')
        .addSelect('COUNT(payout.id)', 'count')
        .addSelect('SUM(payout.amount)', 'total_amount')
        .where('payout.tenant_id = :tenantId', { tenantId })
        .groupBy('payout.status')
        .getRawMany();

      // Parse aggregation results
      let pendingAmount = 0;
      let pendingCount = 0;
      let completedAmount = 0;
      let completedCount = 0;
      let failedCount = 0;

      payoutAggregates.forEach((agg) => {
        const amount = parseInt(agg.total_amount || 0, 10);
        const count = parseInt(agg.count || 0, 10);

        if (agg.status === PayoutStatusEnum.PENDING) {
          pendingAmount = amount;
          pendingCount = count;
        } else if (agg.status === PayoutStatusEnum.SUCCESSFUL) {
          completedAmount = amount;
          completedCount = count;
        } else if (agg.status === PayoutStatusEnum.FAILED) {
          failedCount = count;
        }
      });

      // Get pending and failed payout details for response (limit to 10 each)
      const pendingPayouts = await this.payoutRepository
        .createQueryBuilder('payout')
        .leftJoinAndSelect('payout.tenant_payment_account', 'account')
        .where('payout.tenant_id = :tenantId', { tenantId })
        .andWhere('payout.status = :status', { status: PayoutStatusEnum.PENDING })
        .orderBy('payout.created_at', 'DESC')
        .take(10)
        .getMany();

      const failedPayouts = await this.payoutRepository
        .createQueryBuilder('payout')
        .leftJoinAndSelect('payout.tenant_payment_account', 'account')
        .where('payout.tenant_id = :tenantId', { tenantId })
        .andWhere('payout.status = :status', { status: PayoutStatusEnum.FAILED })
        .orderBy('payout.created_at', 'DESC')
        .take(10)
        .getMany();

      const responseData = {
        period: 'today',
        earnings: {
          gmv: todaysGMV,
          order_count: todaysOrderCount,
          platform_fee: platformFee,
          net_earnings: netEarnings,
        },
        payouts: {
          pending: {
            count: pendingCount,
            amount: pendingAmount,
            payouts: pendingPayouts.map((p) => ({
              id: p.id,
              amount: p.amount,
              destination: p.tenant_payment_account?.momo_number,
              network: p.tenant_payment_account?.network,
              initiated_at: p.created_at,
            })),
          },
          completed: {
            count: completedCount,
            amount: completedAmount,
          },
          failed: {
            count: failedCount,
            payouts: failedPayouts.map((p) => ({
              id: p.id,
              amount: p.amount,
              destination: p.tenant_payment_account?.momo_number,
              network: p.tenant_payment_account?.network,
              initiated_at: p.created_at,
              provider_ref: p.provider_ref,
            })),
          },
        },
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, responseData, 300);

      return {
        success: true,
        data: responseData,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * GET /merchant/settlements/history
   * Get settlement history with filtering
   */
  @Get('history')
  async getSettlementHistory(
    @GetUser() user: JwtPayload,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
    @Query('status') status?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ) {
    try {
      const tenantId = user.tenantId;

      let query = this.payoutRepository
        .createQueryBuilder('payout')
        .where('payout.tenant_id = :tenantId', { tenantId })
        .orderBy('payout.created_at', 'DESC')
        .take(limit)
        .skip(offset);

      if (status) {
        query = query.andWhere('payout.status = :status', { status });
      }

      if (fromDate) {
        query = query.andWhere('payout.created_at >= :fromDate', {
          fromDate: new Date(fromDate),
        });
      }

      if (toDate) {
        query = query.andWhere('payout.created_at <= :toDate', {
          toDate: new Date(toDate),
        });
      }

      const payouts = await query.getMany();
      const total = await query.getCount();

      return {
        success: true,
        data: {
          payouts: payouts.map((p) => ({
            id: p.id,
            amount: p.amount,
            status: p.status,
            initiated_at: p.created_at,
            reference: p.provider_ref,
          })),
          total,
          limit,
          offset,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * GET /merchant/settlements/:id
   * Get settlement details
   */
  @Get(':id')
  async getSettlementDetail(
    @GetUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    try {
      const tenantId = user.tenantId;

      const payout = await this.payoutRepository
        .createQueryBuilder('payout')
        .leftJoinAndSelect('payout.tenant_payment_account', 'account')
        .where('payout.id = :id', { id })
        .andWhere('payout.tenant_id = :tenantId', { tenantId })
        .getOne();

      if (!payout) {
        return {
          success: false,
          error: 'Settlement not found',
        };
      }

      return {
        success: true,
        data: {
          id: payout.id,
          amount: payout.amount,
          status: payout.status,
          destination: payout.tenant_payment_account?.momo_number,
          network: payout.tenant_payment_account?.network,
          initiated_at: payout.created_at,
          reference: payout.provider_ref,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
