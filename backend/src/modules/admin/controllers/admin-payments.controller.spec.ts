import { Test, TestingModule } from '@nestjs/testing';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPaymentManagementService } from '../services/admin-payment-management.service';
import { PaymentService } from '../../payments/services/payment.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentTransaction, TransactionKindEnum } from '../../payments/entities/payment.entity';

describe('AdminPaymentsController', () => {
  let controller: AdminPaymentsController;
  let mockAdminService: any;
  let mockPaymentService: any;
  let module: TestingModule;

  // Mock data
  const mockPayment: PaymentTransaction = {
    id: 'payment-1',
    order_id: 'order-1',
    tenant_id: 'tenant-1',
    amount: 5000,
    currency: 'RWF',
    kind: TransactionKindEnum.CASHIN,
    status: 'COMPLETED',
    provider_ref: 'flw-ref-12345',
    tx_ref: 'tx-ref-123',
    raw_payload: { test: 'data' },
    created_at: new Date(),
  } as PaymentTransaction;

  const mockAdminUser = {
    userId: 'admin-1',
    email: 'admin@example.com',
    role: 'PLATFORM_ADMIN',
  };

  beforeEach(async () => {
    // Mock services
    mockAdminService = {
      createManualPayment: jest.fn(),
      overridePaymentStatus: jest.fn(),
    };

    mockPaymentService = {
      getAllPaymentsPlatformWide: jest.fn().mockResolvedValue([mockPayment]),
      getPaymentDetailsByIdPlatformWide: jest.fn().mockResolvedValue(mockPayment),
    };

    module = await Test.createTestingModule({
      controllers: [AdminPaymentsController],
      providers: [
        { provide: AdminPaymentManagementService, useValue: mockAdminService },
        { provide: PaymentService, useValue: mockPaymentService },
      ],
    }).compile();

    controller = module.get<AdminPaymentsController>(AdminPaymentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listPayments', () => {
    it('should return list of all payments', async () => {
      const result = await controller.listPayments();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('payment-1');
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should filter payments by method', async () => {
      mockPaymentService.getAllPaymentsPlatformWide.mockResolvedValueOnce([]);

      await controller.listPayments('CASH');

      expect(mockPaymentService.getAllPaymentsPlatformWide).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'CASH' }),
        50,
        0,
      );
    });

    it('should filter payments by status', async () => {
      mockPaymentService.getAllPaymentsPlatformWide.mockResolvedValueOnce([]);

      await controller.listPayments(undefined, 'SUCCESSFUL');

      expect(mockPaymentService.getAllPaymentsPlatformWide).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUCCESSFUL' }),
        50,
        0,
      );
    });

    it('should filter payments by restaurant_id', async () => {
      mockPaymentService.getAllPaymentsPlatformWide.mockResolvedValueOnce([]);

      await controller.listPayments(undefined, undefined, 'restaurant-1');

      expect(mockPaymentService.getAllPaymentsPlatformWide).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'restaurant-1' }),
        50,
        0,
      );
    });

    it('should apply pagination', async () => {
      mockPaymentService.getAllPaymentsPlatformWide.mockResolvedValueOnce([]);

      await controller.listPayments(undefined, undefined, undefined, undefined, undefined, undefined, 100, 200);

      expect(mockPaymentService.getAllPaymentsPlatformWide).toHaveBeenCalledWith(
        expect.any(Object),
        100,
        200,
      );
    });

    it('should handle errors gracefully', async () => {
      mockPaymentService.getAllPaymentsPlatformWide.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      const result = await controller.listPayments();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('getPayment', () => {
    it('should return payment details', async () => {
      const result = await controller.getPayment('payment-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('payment-1');
      expect(result.data.amount).toBe(5000);
      expect(result.data.status).toBe('COMPLETED');
    });

    it('should handle payment not found', async () => {
      mockPaymentService.getPaymentDetailsByIdPlatformWide.mockRejectedValueOnce(
        new NotFoundException('Payment not found'),
      );

      const result = await controller.getPayment('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });

    it('should handle generic errors', async () => {
      mockPaymentService.getPaymentDetailsByIdPlatformWide.mockRejectedValueOnce(
        new Error('Internal server error'),
      );

      const result = await controller.getPayment('payment-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });
  });

  describe('createManualPayment', () => {
    it('should create manual payment successfully', async () => {
      const createPaymentDto = {
        order_id: 'order-1',
        tenant_id: 'tenant-1',
        amount: 5000,
        currency: 'RWF',
        method: 'CASH',
        reason: 'Testing',
      };

      mockAdminService.createManualPayment.mockResolvedValueOnce(mockPayment);

      const result = await controller.createManualPayment(mockAdminUser, createPaymentDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Manual payment created successfully');
      expect(result.data.id).toBe('payment-1');
      expect(result.data.amount).toBe(5000);

      expect(mockAdminService.createManualPayment).toHaveBeenCalledWith(
        createPaymentDto,
        'admin-1',
      );
    });

    it('should handle manual payment creation errors', async () => {
      const createPaymentDto = {
        order_id: 'order-1',
        tenant_id: 'tenant-1',
        amount: 5000,
        currency: 'RWF',
        method: 'CASH',
      };

      mockAdminService.createManualPayment.mockRejectedValueOnce(
        new BadRequestException('Order not found'),
      );

      const result = await controller.createManualPayment(mockAdminUser, createPaymentDto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });
  });

  describe('overridePaymentStatus', () => {
    it('should override payment status successfully', async () => {
      const overrideDto = {
        new_status: 'SUCCESSFUL',
        reason: 'Reconciliation - correcting erroneous failure',
      };

      mockAdminService.overridePaymentStatus.mockResolvedValueOnce({
        ...mockPayment,
        status: 'SUCCESSFUL',
      });

      const result = await controller.overridePaymentStatus(
        mockAdminUser,
        'payment-1',
        overrideDto,
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('SUCCESSFUL');

      expect(mockAdminService.overridePaymentStatus).toHaveBeenCalledWith(
        'payment-1',
        'SUCCESSFUL',
        'admin-1',
        'Reconciliation - correcting erroneous failure',
      );
    });

    it('should reject override without new_status', async () => {
      const overrideDto = {
        new_status: undefined,
        reason: 'Some reason',
      };

      const result = await controller.overridePaymentStatus(
        mockAdminUser,
        'payment-1',
        overrideDto,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('new_status and reason are required');
    });

    it('should reject override without reason', async () => {
      const overrideDto = {
        new_status: 'SUCCESSFUL',
        reason: undefined,
      };

      const result = await controller.overridePaymentStatus(
        mockAdminUser,
        'payment-1',
        overrideDto,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('new_status and reason are required');
    });

    it('should handle override errors', async () => {
      const overrideDto = {
        new_status: 'SUCCESSFUL',
        reason: 'Some reason for override',
      };

      mockAdminService.overridePaymentStatus.mockRejectedValueOnce(
        new NotFoundException('Payment not found'),
      );

      const result = await controller.overridePaymentStatus(
        mockAdminUser,
        'nonexistent',
        overrideDto,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });
  });
});
