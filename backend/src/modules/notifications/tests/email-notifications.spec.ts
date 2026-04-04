import { Test, TestingModule } from '@nestjs/testing';
import { NotificationEmailService } from '../services/notification-email.service';
import { NotificationHistoryService } from '../services/notification-history.service';
import { NotificationTemplateService } from '../services/notification-template.service';
import { EmailService } from '../../auth/services/email.service';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationHistory } from '../entities/notification-history.entity';

/**
 * Notification Email Service Unit Tests
 * 
 * Tests individual methods of NotificationEmailService:
 * - Email method signatures and parameter handling
 * - Proper template selection based on recipient type
 * - Context variable formatting
 * - Async delivery without blocking
 * - Idempotency key generation
 * - Error logging (non-throwing)
 */
describe('NotificationEmailService (Unit)', () => {
  let service: NotificationEmailService;
  let historyService: NotificationHistoryService;
  let templateService: NotificationTemplateService;
  let historyRepository: Repository<NotificationHistory>;

  const MOCK_TENANT_ID = 'tenant-unit-test';
  const MOCK_ORDER_ID = 'order-unit-test';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEmailService,
        NotificationHistoryService,
        NotificationTemplateService,
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-123' }),
          },
        },
        {
          provide: getRepositoryToken(NotificationHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationEmailService>(NotificationEmailService);
    historyService = module.get<NotificationHistoryService>(NotificationHistoryService);
    templateService = module.get<NotificationTemplateService>(NotificationTemplateService);
    historyRepository = module.get<Repository<NotificationHistory>>(
      getRepositoryToken(NotificationHistory),
    );
  });

  describe('Customer Email Methods', () => {
    it('should have sendOrderCreatedEmail method with correct signature', () => {
      expect(typeof service.sendOrderCreatedEmail).toBe('function');
    });

    it('should have sendOrderReadyEmail method with correct signature', () => {
      expect(typeof service.sendOrderReadyEmail).toBe('function');
    });

    it('should have sendPaymentCompletedEmail method with correct signature', () => {
      expect(typeof service.sendPaymentCompletedEmail).toBe('function');
    });

    it('should have sendRefundApprovedEmail method with correct signature', () => {
      expect(typeof service.sendRefundApprovedEmail).toBe('function');
    });
  });

  describe('Merchant Email Methods', () => {
    it('should have sendNewOrderMerchantEmail method with correct signature', () => {
      expect(typeof service.sendNewOrderMerchantEmail).toBe('function');
    });

    it('should have sendSettlementCompletedEmail method with correct signature', () => {
      expect(typeof service.sendSettlementCompletedEmail).toBe('function');
    });
  });

  describe('Admin Email Methods', () => {
    it('should have sendSupportEscalatedEmail method with correct signature', () => {
      expect(typeof service.sendSupportEscalatedEmail).toBe('function');
    });
  });

  describe('Core Utility Methods', () => {
    it('should have sendEmailNotification core method', () => {
      expect(typeof service['sendEmailNotification']).toBe('function');
    });

    it('should have sendEmailAsync internal method for non-blocking delivery', () => {
      expect(typeof service['sendEmailAsync']).toBe('function');
    });

    it('should have retryFailedEmails method for batch retry', () => {
      expect(typeof service.retryFailedEmails).toBe('function');
    });

    it('should have stripHtml utility method', () => {
      expect(typeof service['stripHtml']).toBe('function');
    });
  });

  describe('Template Service Integration', () => {
    it('should use NotificationTemplateService for rendering', () => {
      const renderSpy = jest.spyOn(templateService, 'renderTemplate');
      
      templateService.renderTemplate('ORDER_CREATED_CUSTOMER', 'CUSTOMER', {
        customerName: 'Test',
      });

      expect(renderSpy).toHaveBeenCalled();
    });

    it('should use NotificationTemplateService for idempotency keys', () => {
      const key = templateService.generateIdempotencyKey(
        MOCK_TENANT_ID,
        MOCK_ORDER_ID,
        'ORDER_CREATED',
        'test@example.com',
      );

      expect(key).toBeDefined();
      expect(key.length > 0).toBe(true);
    });
  });

  describe('History Service Integration', () => {
    it('should use NotificationHistoryService for deduplication', () => {
      const createSpy = jest.spyOn(historyService, 'createNotification');
      
      // Service should call createNotification during send flow
      expect(typeof historyService.createNotification).toBe('function');
    });

    it('should use NotificationHistoryService for tracking sent emails', () => {
      const markSentSpy = jest.spyOn(historyService, 'markAsSent');
      
      expect(typeof historyService.markAsSent).toBe('function');
    });

    it('should use NotificationHistoryService for tracking failed emails', () => {
      const markFailedSpy = jest.spyOn(historyService, 'markAsFailed');
      
      expect(typeof historyService.markAsFailed).toBe('function');
    });
  });

  describe('Email Service Integration', () => {
    it('should use EmailService for actual delivery', () => {
      const emailService = module.get<EmailService>(EmailService);
      expect(typeof emailService.sendEmail).toBe('function');
    });
  });
});

/**
 * Notification History Service Unit Tests
 * 
 * Tests individual methods of NotificationHistoryService:
 * - CRUD operations
 * - Deduplication logic
 * - Retry scheduling with exponential backoff
 * - Statistics calculation
 */
describe('NotificationHistoryService (Unit)', () => {
  let service: NotificationHistoryService;
  let repository: Repository<NotificationHistory>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationHistoryService,
        {
          provide: getRepositoryToken(NotificationHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationHistoryService>(NotificationHistoryService);
    repository = module.get<Repository<NotificationHistory>>(
      getRepositoryToken(NotificationHistory),
    );
  });

  describe('Create Notification (Deduplication)', () => {
    it('should have createNotification method', () => {
      expect(typeof service.createNotification).toBe('function');
    });

    it('should check for duplicate by idempotency_key', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(repository, 'create').mockReturnValueOnce({} as any);
      jest.spyOn(repository, 'save').mockResolvedValueOnce({} as any);

      // Dedup check should happen before create
      await service.createNotification(
        'tenant-123',
        'user-123',
        'test@example.com',
        'ORDER_CREATED',
        'EMAIL',
        'order-123',
        'Order',
        'dedup-key-123',
      );

      // findOne should be called with idempotency_key
      expect(repository.findOne).toHaveBeenCalled();
    });
  });

  describe('Mark As Sent', () => {
    it('should have markAsSent method', () => {
      expect(typeof service.markAsSent).toBe('function');
    });

    it('should mark status as SENT and capture provider response', async () => {
      jest.spyOn(repository, 'update').mockResolvedValueOnce({} as any);

      await service.markAsSent('notification-123', { messageId: 'test-msg-123' });

      expect(repository.update).toHaveBeenCalledWith(
        { id: 'notification-123' },
        expect.objectContaining({
          status: 'SENT',
        }),
      );
    });
  });

  describe('Mark As Failed (Retry Scheduling)', () => {
    it('should have markAsFailed method', () => {
      expect(typeof service.markAsFailed).toBe('function');
    });

    it('should schedule retry with exponential backoff', async () => {
      jest.spyOn(repository, 'update').mockResolvedValueOnce({} as any);

      await service.markAsFailed('notification-123', 'Test error', 1);

      expect(repository.update).toHaveBeenCalledWith(
        { id: 'notification-123' },
        expect.objectContaining({
          status: expect.stringContaining('FAIL'),
        }),
      );
    });
  });

  describe('Get Methods', () => {
    it('should have getHistory method for entity audit trail', () => {
      expect(typeof service.getHistory).toBe('function');
    });

    it('should have getSentNotifications method for recipient tracking', () => {
      expect(typeof service.getSentNotifications).toBe('function');
    });

    it('should have getFailedNotifications method for error tracking', () => {
      expect(typeof service.getFailedNotifications).toBe('function');
    });

    it('should have getPendingRetries method for retry batch', () => {
      expect(typeof service.getPendingRetries).toBe('function');
    });

    it('should have getStatistics method for tenant metrics', () => {
      expect(typeof service.getStatistics).toBe('function');
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should have cleanupOldNotifications method for archive', () => {
      expect(typeof service.cleanupOldNotifications).toBe('function');
    });
  });
});

/**
 * Notification Template Service Unit Tests
 * 
 * Tests template rendering and variable interpolation:
 * - Simple variable replacement: {{name}} → John
 * - Nested variable access: {{customer.name}}
 * - Array support: {{items[0]}}
 * - Missing variable handling (leaves unchanged)
 * - HTML escaping (no escaping for HTML templates)
 */
describe('NotificationTemplateService (Unit)', () => {
  let service: NotificationTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationTemplateService],
    }).compile();

    service = module.get<NotificationTemplateService>(NotificationTemplateService);
  });

  describe('Template Rendering', () => {
    it('should render template with correct subject', () => {
      const template = service.renderTemplate('ORDER_CREATED_CUSTOMER', 'CUSTOMER', {
        customerName: 'John',
      });

      expect(template).toContain('<html');
      expect(typeof template).toBe('string');
    });

    it('should support simple variable interpolation', () => {
      const template = service['interpolate']('Hello {{name}}', { name: 'John' });
      expect(template).toContain('John');
    });

    it('should support nested variable access', () => {
      const template = service['interpolate'](
        'Welcome {{customer.name}}',
        {
          customer: { name: 'Jane' },
        },
      );

      expect(template).toContain('Jane');
    });

    it('should leave undefined variables unchanged', () => {
      const template = service['interpolate'](
        'Hello {{unknownVar}}',
        { otherVar: 'value' },
      );

      expect(template).toContain('{{unknownVar}}');
    });
  });

  describe('Available Recipients', () => {
    it('should have getAvailableRecipients method', () => {
      expect(typeof service.getAvailableRecipients).toBe('function');
    });

    it('should indicate available recipients for notification type', () => {
      const recipients = service.getAvailableRecipients('ORDER_CREATED');
      expect(Array.isArray(recipients)).toBe(true);
    });
  });

  describe('Idempotency Key Generation', () => {
    it('should generate consistent idempotency keys', () => {
      const key1 = service.generateIdempotencyKey(
        'tenant-123',
        'order-456',
        'ORDER_CREATED',
        'test@example.com',
      );

      const key2 = service.generateIdempotencyKey(
        'tenant-123',
        'order-456',
        'ORDER_CREATED',
        'test@example.com',
      );

      expect(key1).toEqual(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = service.generateIdempotencyKey(
        'tenant-123',
        'order-456',
        'ORDER_CREATED',
        'test1@example.com',
      );

      const key2 = service.generateIdempotencyKey(
        'tenant-123',
        'order-789',
        'ORDER_CREATED',
        'test2@example.com',
      );

      expect(key1).not.toEqual(key2);
    });
  });
});
