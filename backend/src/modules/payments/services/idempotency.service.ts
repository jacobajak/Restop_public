import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import {
  IdempotencyKey,
  IdempotencyStatusEnum,
  OperationTypeEnum,
} from '../entities/idempotency-key.entity';

/**
 * IdempotencyService
 *
 * Implements the idempotency pattern for critical payment operations.
 *
 * Usage:
 * ```
 * const key = await service.checkIdempotency(
 *   'my-idempotency-key',
 *   OperationTypeEnum.PAYMENT_INITIATION,
 *   payloadObject
 * );
 *
 * if (key.response_snapshot) {
 *   // Already executed - return cached response
 *   return key.response_snapshot;
 * }
 *
 * try {
 *   const result = await paymentService.initiate(payload);
 *   await service.recordSuccess(key.id, result);
 * } catch (error) {
 *   await service.recordFailure(key.id, error.message);
 *   throw error;
 * }
 * ```
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private idempotencyKeyRepository: Repository<IdempotencyKey>,
  ) {}

  /**
   * Check if operation with this key already exists
   *
   * Returns the idempotency record if found. Caller should:
   * - If record.response_snapshot exists → return cached response
   * - If record.status === PROCESSING → wait or error
   * - If record not found → proceed with operation
   *
   * If same key but different payload → throws BadRequestException
   *
   * @param idempotencyKey - Client-provided unique key
   * @param operationType - Type of operation being protected
   * @param payload - Request payload (will be hashed)
   * @returns IdempotencyKey record or new pending record
   *
   * @throws BadRequestException if same key + different payload
   * @throws Other errors on database failures
   */
  async checkIdempotency(
    idempotencyKey: string,
    operationType: OperationTypeEnum,
    payload: Record<string, any>,
  ): Promise<IdempotencyKey> {
    const requestHash = this.hashPayload(payload);

    try {
      // Try to find existing key
      const existing = await this.idempotencyKeyRepository.findOne({
        where: { idempotency_key: idempotencyKey },
      });

      if (existing) {
        // Key exists - check payload matches
        if (existing.request_hash !== requestHash) {
          this.logger.warn(
            `Idempotency key reused with different payload: ${idempotencyKey}`,
          );
          throw new BadRequestException(
            'Idempotency key used with different request payload. This operation cannot be retried with different parameters.',
          );
        }

        // Payload matches - return existing record
        this.logger.debug(
          `Found existing idempotency record: ${idempotencyKey} (status: ${existing.status})`,
        );
        return existing;
      }

      // Key doesn't exist - create pending record
      const newKey = new IdempotencyKey({
        idempotency_key: idempotencyKey,
        operation_type: operationType,
        request_hash: requestHash,
        request_payload: payload,
        status: IdempotencyStatusEnum.PROCESSING,
        expires_at: this.calculateExpiresAt(operationType),
      });

      const saved = await this.idempotencyKeyRepository.save(newKey);
      this.logger.debug(
        `Created new idempotency record: ${idempotencyKey} for ${operationType}`,
      );
      return saved;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Error checking idempotency for ${idempotencyKey}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Record successful completion of operation
   * Stores response snapshot in the idempotency record
   *
   * @param idempotencyKeyId - ID of idempotency record
   * @param response - The response/result to cache
   * @returns Updated IdempotencyKey record
   */
  async recordSuccess(
    idempotencyKeyId: string,
    response: Record<string, any>,
  ): Promise<IdempotencyKey> {
    try {
      const key = await this.idempotencyKeyRepository.findOne({ where: { id: idempotencyKeyId } });
      if (!key) throw new Error(`Idempotency key not found: ${idempotencyKeyId}`);
      
      key.status = IdempotencyStatusEnum.SUCCESS;
      key.response_snapshot = response;
      key.updated_at = new Date();
      
      const updated = await this.idempotencyKeyRepository.save(key);

      this.logger.debug(`Marked idempotency key as SUCCESS: ${idempotencyKeyId}`);
      return updated;
    } catch (error) {
      this.logger.error(
        `Error recording success for ${idempotencyKeyId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Record failure of operation
   * Marks record as FAILED with error message
   *
   * @param idempotencyKeyId - ID of idempotency record
   * @param errorMessage - Error that occurred
   * @returns Updated IdempotencyKey record
   */
  async recordFailure(
    idempotencyKeyId: string,
    errorMessage: string,
  ): Promise<IdempotencyKey> {
    try {
      const key = await this.idempotencyKeyRepository.findOne({ where: { id: idempotencyKeyId } });
      if (!key) throw new Error(`Idempotency key not found: ${idempotencyKeyId}`);
      
      key.status = IdempotencyStatusEnum.FAILED;
      key.error_message = errorMessage.substring(0, 1000); // Truncate to 1000 chars
      key.updated_at = new Date();
      
      const updated = await this.idempotencyKeyRepository.save(key);

      this.logger.debug(
        `Marked idempotency key as FAILED: ${idempotencyKeyId}`,
      );
      return updated;
    } catch (error) {
      this.logger.error(
        `Error recording failure for ${idempotencyKeyId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get idempotency record by key
   * Used for debugging and monitoring
   *
   * @param idempotencyKey - The idempotency key string
   * @returns IdempotencyKey record or null if not found
   */
  async getByKey(idempotencyKey: string): Promise<IdempotencyKey | null> {
    return this.idempotencyKeyRepository.findOne({
      where: { idempotency_key: idempotencyKey },
    });
  }

  /**
   * Get idempotency record by ID
   * Used internally by other services
   *
   * @param id - The record ID
   * @returns IdempotencyKey record or null if not found
   */
  async getById(id: string): Promise<IdempotencyKey | null> {
    return this.idempotencyKeyRepository.findOne({
      where: { id },
    });
  }

  /**
   * Clean up expired idempotency keys
   * Called by scheduled job to prevent table bloat
   *
   * Keys are expired and can be deleted if:
   * - expires_at < now
   * - AND status === SUCCESS (don't delete failed keys for audit)
   *
   * @returns Count of deleted records
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await this.idempotencyKeyRepository.delete({
        expires_at: LessThan(new Date()),
        status: IdempotencyStatusEnum.SUCCESS,
      });

      const count = result.affected || 0;
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired idempotency keys`);
      }
      return count;
    } catch (error) {
      this.logger.error(`Error cleaning up expired keys: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get failed idempotency records for manual review
   * Used by admin dashboard to show stuck operations
   *
   * @param limit - Max records to return
   * @returns List of failed operations
   */
  async getFailedOperations(limit: number = 50): Promise<IdempotencyKey[]> {
    return this.idempotencyKeyRepository.find({
      where: { status: IdempotencyStatusEnum.FAILED },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Calculate expiration timestamp based on operation type
   * Different operations have different expiration windows
   *
   * @param operationType - Type of operation
   * @returns Date when this key should expire
   */
  private calculateExpiresAt(operationType: OperationTypeEnum): Date {
    const now = new Date();
    const expiresMs = this.getExpirationMs(operationType);
    return new Date(now.getTime() + expiresMs);
  }

  /**
   * Get expiration time in milliseconds by operation type
   * Longer times for operations where retries are common
   *
   * @param _operationType - Type of operation
   * @returns Milliseconds until expiration
   */
  private getExpirationMs(_operationType: OperationTypeEnum): number {
    // All operations expire after 24 hours by default
    // Can be customized per operation if needed
    return 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Create SHA-256 hash of payload for comparison
   * Used to detect if same key is reused with different payload
   *
   * @param payload - Request payload to hash
   * @returns SHA-256 hex digest
   */
  private hashPayload(payload: Record<string, any>): string {
    const json = JSON.stringify(payload);
    return crypto.createHash('sha256').update(json).digest('hex');
  }
}
