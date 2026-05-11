import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException } from '@nestjs/common';
import { IdempotencyMiddleware } from '../middleware/idempotency.middleware';
import { IdempotencyService } from '../services/idempotency.service';
import { IdempotencyStatusEnum, OperationTypeEnum } from '../entities/idempotency-key.entity';
import { Request, Response } from 'express';

describe('IdempotencyMiddleware', () => {
  let middleware: IdempotencyMiddleware;
  let idempotencyService: IdempotencyService;

  beforeEach(async () => {
    // Mock IdempotencyService
    idempotencyService = {
      getByKey: jest.fn(),
      checkIdempotency: jest.fn(),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      cleanupExpiredKeys: jest.fn(),
    } as any;

    middleware = new IdempotencyMiddleware(idempotencyService);
  });

  describe('use', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
      mockReq = {
        method: 'POST',
        path: '/orders/123/pay',
        headers: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    it('should pass through GET/DELETE requests', async () => {
      mockReq.method = 'GET';
      await middleware.use(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through non-payment endpoints', async () => {
      mockReq.path = '/users/profile';
      await middleware.use(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through when no idempotency key provided', async () => {
      mockReq.headers = {};
      await middleware.use(mockReq as Request, mockRes as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid idempotency key format', async () => {
      mockReq.headers = { 'idempotency-key': 'invalid' };
      
      await expect(
        middleware.use(mockReq as Request, mockRes as Response, next),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return 409 if operation is still processing', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      mockReq.headers = { 'idempotency-key': key };
      
      (idempotencyService.getByKey as jest.Mock).mockResolvedValue({
        status: IdempotencyStatusEnum.PROCESSING,
      });

      await middleware.use(mockReq as Request, mockRes as Response, next);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it('should return cached response if operation succeeded', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      mockReq.headers = { 'idempotency-key': key };
      const cachedResponse = { ok: true, data: 'cached' };
      
      (idempotencyService.getByKey as jest.Mock).mockResolvedValue({
        status: IdempotencyStatusEnum.SUCCESS,
        response_snapshot: cachedResponse,
      });

      await middleware.use(mockReq as Request, mockRes as Response, next);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          cached: true,
        }),
      );
    });

    it('should return cached error if operation failed', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      mockReq.headers = { 'idempotency-key': key };
      const errorMessage = 'Payment declined';
      
      (idempotencyService.getByKey as jest.Mock).mockResolvedValue({
        status: IdempotencyStatusEnum.FAILED,
        error_message: errorMessage,
      });

      await middleware.use(mockReq as Request, mockRes as Response, next);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          error: 'Operation previously failed',
        }),
      );
    });

    it('should attach idempotency context to request', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      mockReq.headers = { 'idempotency-key': key };
      
      (idempotencyService.getByKey as jest.Mock).mockResolvedValue(null);

      await middleware.use(mockReq as Request, mockRes as Response, next);

      expect((mockReq as any).idempotency).toEqual({
        key,
        operationType: OperationTypeEnum.PAYMENT_INITIATION,
      });
      expect(next).toHaveBeenCalled();
    });

    it('should determine correct operation type from path', async () => {
      const testCases = [
        { path: '/orders/123/pay', expected: OperationTypeEnum.PAYMENT_INITIATION },
        { path: '/orders/123/mark-paid', expected: OperationTypeEnum.PAYMENT_VERIFICATION },
        { path: '/refund', expected: OperationTypeEnum.REFUND_CREATION },
        { path: '/cashout', expected: OperationTypeEnum.PAYOUT_CREATION },
        { path: '/webhooks/flutterwave', expected: OperationTypeEnum.WEBHOOK_PROCESSING },
      ];

      for (const testCase of testCases) {
        mockReq.path = testCase.path;
        (idempotencyService.getByKey as jest.Mock).mockResolvedValue(null);

        await middleware.use(mockReq as Request, mockRes as Response, next);

        expect((mockReq as any).idempotency.operationType).toBe(testCase.expected);
      }
    });

    it('should validate UUID format', async () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000', // v4
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8', // v1
      ];

      for (const uuid of validUUIDs) {
        mockReq.headers = { 'idempotency-key': uuid };
        (idempotencyService.getByKey as jest.Mock).mockResolvedValue(null);

        await middleware.use(mockReq as Request, mockRes as Response, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it('should validate alphanumeric format (min 16 chars)', async () => {
      const validKeys = [
        'a1b2c3d4e5f6g7h8',
        'request-key-12345',
        'test_idempotency_key',
      ];

      for (const key of validKeys) {
        mockReq.headers = { 'idempotency-key': key };
        (idempotencyService.getByKey as jest.Mock).mockResolvedValue(null);

        await middleware.use(mockReq as Request, mockRes as Response, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it('should reject too short alphanumeric keys', async () => {
      mockReq.headers = { 'idempotency-key': 'short123' }; // Only 8 chars

      await expect(
        middleware.use(mockReq as Request, mockRes as Response, next),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let repository: any;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };

    service = new IdempotencyService(repository);
  });

  describe('checkIdempotency', () => {
    it('should create new idempotency record if key does not exist', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const payload = { orderId: '123' };
      
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue({
        idempotency_key: key,
        status: IdempotencyStatusEnum.PROCESSING,
      });
      repository.save.mockResolvedValue({
        id: 'key-id-1',
        idempotency_key: key,
        status: IdempotencyStatusEnum.PROCESSING,
      });

      const result = await service.checkIdempotency(
        key,
        OperationTypeEnum.PAYMENT_INITIATION,
        payload,
      );

      expect(result.status).toBe(IdempotencyStatusEnum.PROCESSING);
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw if key exists with different payload hash', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const payload1 = { orderId: '123', amount: 100 };
      const payload2 = { orderId: '123', amount: 200 };

      repository.findOne.mockResolvedValue({
        idempotency_key: key,
        request_hash: 'hash-for-payload1',
      });

      await expect(
        service.checkIdempotency(key, OperationTypeEnum.PAYMENT_INITIATION, payload2),
      ).rejects.toThrow();
    });

    it('should return existing record if key and payload match', async () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const payload = { orderId: '123' };

      const existingRecord = {
        id: 'key-id-1',
        idempotency_key: key,
        status: IdempotencyStatusEnum.PROCESSING,
      };

      repository.findOne.mockResolvedValue(existingRecord);

      const result = await service.checkIdempotency(
        key,
        OperationTypeEnum.PAYMENT_INITIATION,
        payload,
      );

      expect(result).toEqual(existingRecord);
    });
  });

  describe('recordSuccess', () => {
    it('should update record with SUCCESS status and response snapshot', async () => {
      const recordId = 'key-id-1';
      const response = { ok: true, data: 'success' };

      const record = {
        id: recordId,
        status: IdempotencyStatusEnum.PROCESSING,
        response_snapshot: null,
      };

      repository.findOne.mockResolvedValue(record);
      repository.save.mockResolvedValue({
        ...record,
        status: IdempotencyStatusEnum.SUCCESS,
        response_snapshot: response,
      });

      const result = await service.recordSuccess(recordId, response);

      expect(result.status).toBe(IdempotencyStatusEnum.SUCCESS);
      expect(result.response_snapshot).toEqual(response);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('recordFailure', () => {
    it('should update record with FAILED status and error message', async () => {
      const recordId = 'key-id-1';
      const errorMessage = 'Payment declined by provider';

      const record = {
        id: recordId,
        status: IdempotencyStatusEnum.PROCESSING,
      };

      repository.findOne.mockResolvedValue(record);
      repository.save.mockResolvedValue({
        ...record,
        status: IdempotencyStatusEnum.FAILED,
        error_message: errorMessage,
      });

      const result = await service.recordFailure(recordId, errorMessage);

      expect(result.status).toBe(IdempotencyStatusEnum.FAILED);
      expect(result.error_message).toContain('Payment declined');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should truncate error message to 1000 chars', async () => {
      const recordId = 'key-id-1';
      const longError = 'a'.repeat(2000);

      const record = { id: recordId, status: IdempotencyStatusEnum.PROCESSING };
      
      repository.findOne.mockResolvedValue(record);
      repository.save.mockResolvedValue({
        ...record,
        status: IdempotencyStatusEnum.FAILED,
        error_message: 'a'.repeat(1000),
      });

      const result = await service.recordFailure(recordId, longError);

      expect(result.error_message.length).toBe(1000);
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should delete expired SUCCESS records', async () => {
      repository.delete.mockResolvedValue({ affected: 42 });

      const count = await service.cleanupExpiredKeys();

      expect(count).toBe(42);
      expect(repository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          status: IdempotencyStatusEnum.SUCCESS,
        }),
      );
    });

    it('should not delete FAILED records (for audit)', async () => {
      repository.delete.mockResolvedValue({ affected: 0 });

      await service.cleanupExpiredKeys();

      expect(repository.delete).not.toHaveBeenCalledWith(
        expect.objectContaining({
          status: IdempotencyStatusEnum.FAILED,
        }),
      );
    });
  });

  describe('hashPayload', () => {
    it('should generate consistent SHA-256 hashes', async () => {
      const payload = { orderId: '123', amount: 100 };

      const hash1 = (service as any).hashPayload(payload);
      const hash2 = (service as any).hashPayload(payload);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex is 64 chars
    });

    it('should generate different hashes for different payloads', async () => {
      const payload1 = { orderId: '123', amount: 100 };
      const payload2 = { orderId: '123', amount: 200 };

      const hash1 = (service as any).hashPayload(payload1);
      const hash2 = (service as any).hashPayload(payload2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculateExpiresAt', () => {
    it('should set expiration to 24 hours in the future', () => {
      const now = new Date();
      const expiresAt = (service as any).calculateExpiresAt(OperationTypeEnum.PAYMENT_INITIATION);

      const diffMs = expiresAt.getTime() - now.getTime();
      const expectedMs = 24 * 60 * 60 * 1000; // 24 hours
      
      // Allow 5 second variance for test execution time
      expect(Math.abs(diffMs - expectedMs)).toBeLessThan(5000);
    });
  });

  describe('getFailedOperations', () => {
    it('should return failed operations sorted by creation date', async () => {
      const failedOps = [
        { id: '1', status: IdempotencyStatusEnum.FAILED, created_at: new Date() },
        { id: '2', status: IdempotencyStatusEnum.FAILED, created_at: new Date() },
      ];

      repository.find.mockResolvedValue(failedOps);

      const result = await service.getFailedOperations(10);

      expect(result).toEqual(failedOps);
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: IdempotencyStatusEnum.FAILED },
          order: { created_at: 'DESC' },
          take: 10,
        }),
      );
    });
  });
});
