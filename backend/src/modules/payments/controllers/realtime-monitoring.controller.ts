import {
  Controller,
  Get,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '../../../modules/users/entities/user.entity';
import { PaymentRealtimeService } from '../services/payment-realtime.service';

/**
 * Real-Time Monitoring Controller
 *
 * Provides endpoints for monitoring real-time payment updates system.
 *
 * Endpoints:
 * - GET /realtime/status - System health and metrics
 * - GET /realtime/connections - Active connections count
 * - GET /realtime/health - Health check
 *
 * Use Cases:
 * - Dashboard monitoring
 * - Health checks
 * - Performance metrics
 * - Debugging real-time issues
 */
@Controller('realtime')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PaymentRealtimeMonitoringController {
  private readonly logger = new Logger(PaymentRealtimeMonitoringController.name);

  constructor(
    private readonly realtimeService: PaymentRealtimeService,
  ) {}

  /**
   * GET /realtime/status
   *
   * Get real-time system status and metrics
   *
   * Returns:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "activeUsers": 42,
   *     "totalSubscriptions": 89,
   *     "io": "Connected",
   *     "timestamp": "2024-01-15T10:15:00Z",
   *     "uptime": 3600000
   *   }
   * }
   * ```
   */
  @Get('status')
  @Roles(UserRole.PLATFORM_ADMIN)
  getStatus() {
    try {
      const status = this.realtimeService.getStatus();

      this.logger.log(
        `📊 Status check: users=${status.activeUsers}, subs=${status.totalSubscriptions}, io=${status.io}`,
      );

      return {
        success: true,
        data: {
          ...status,
          timestamp: new Date(),
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to get status: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * GET /realtime/connections
   *
   * Get active WebSocket connections count
   *
   * Returns:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "activeConnections": 42,
   *     "activeUsers": 40,
   *     "totalSubscriptions": 89,
   *     "timestamp": "2024-01-15T10:15:00Z"
   *   }
   * }
   * ```
   */
  @Get('connections')
  @Roles(UserRole.PLATFORM_ADMIN)
  getConnections() {
    try {
      const status = this.realtimeService.getStatus();

      return {
        success: true,
        data: {
          activeConnections: status.activeUsers,
          activeUsers: status.activeUsers,
          totalSubscriptions: status.totalSubscriptions,
          timestamp: new Date(),
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to get connections: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * GET /realtime/health
   *
   * Health check for real-time system
   *
   * Returns:
   * ```json
   * {
   *   "success": true,
   *   "status": "healthy",
   *   "io": "Connected",
   *   "timestamp": "2024-01-15T10:15:00Z"
   * }
   * ```
   */
  @Get('health')
  getHealth() {
    try {
      const status = this.realtimeService.getStatus();
      const isHealthy = status.io === 'Connected';

      return {
        success: true,
        status: isHealthy ? 'healthy' : 'degraded',
        io: status.io,
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.logger.error(`Health check failed: ${error.message}`);
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
      };
    }
  }
}
