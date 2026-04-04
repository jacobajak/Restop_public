import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateIdempotencyKeysTable1710700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'idempotency_keys',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'operation_type',
            type: 'enum',
            enum: [
              'payment.initiation',
              'payment.verification',
              'refund.creation',
              'settlement.trigger',
              'webhook.processing',
              'payout.creation',
            ],
            isNullable: false,
          },
          {
            name: 'request_hash',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'request_payload',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'response_snapshot',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['processing', 'success', 'failed'],
            isNullable: false,
            default: "'processing'",
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Unique index on idempotency_key for deduplication
    await queryRunner.createIndex(
      'idempotency_keys',
      new TableIndex({
        name: 'IDX_idempotency_keys_unique',
        columnNames: ['idempotency_key'],
        isUnique: true,
      }),
    );

    // Index for finding keys to clean up (expired)
    await queryRunner.createIndex(
      'idempotency_keys',
      new TableIndex({
        name: 'IDX_idempotency_keys_cleanup',
        columnNames: ['operation_type', 'expires_at'],
      }),
    );

    // Index for finding failed operations that need review
    await queryRunner.createIndex(
      'idempotency_keys',
      new TableIndex({
        name: 'IDX_idempotency_keys_failed',
        columnNames: ['status', 'created_at'],
        where: "status = 'failed'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('idempotency_keys', true);
  }
}
