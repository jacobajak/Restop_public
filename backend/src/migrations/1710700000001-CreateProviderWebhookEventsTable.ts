import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateProviderWebhookEventsTable1710700000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'provider_webhook_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'provider',
            type: 'enum',
            enum: ['flutterwave', 'paypack', 'stripe'],
            isNullable: false,
          },
          {
            name: 'event_type',
            type: 'enum',
            enum: [
              'charge.completed',
              'charge.failed',
              'charge.cancelled',
              'transfer.completed',
              'transfer.failed',
              'refund.created',
              'refund.failed',
              'ussd.initiated',
              'ussd.completed',
              'ussd.failed',
            ],
            isNullable: false,
          },
          {
            name: 'event_reference',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'payload_json',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'processing_status',
            type: 'enum',
            enum: [
              'received',
              'processing',
              'success',
              'failed',
              'retry_pending',
              'dead_letter',
            ],
            isNullable: false,
            default: "'received'",
          },
          {
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'last_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'received_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'processed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'next_retry_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'signature',
            type: 'text',
            isNullable: true,
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

    // Index for finding webhooks by provider + event type + recency
    await queryRunner.createIndex(
      'provider_webhook_events',
      new TableIndex({
        name: 'IDX_webhook_events_provider_event',
        columnNames: ['provider', 'event_type', 'created_at'],
      }),
    );

    // Index for finding webhooks by reference (transaction/transfer ID)
    await queryRunner.createIndex(
      'provider_webhook_events',
      new TableIndex({
        name: 'IDX_webhook_events_reference',
        columnNames: ['event_reference'],
      }),
    );

    // Index for finding failed/pending webhooks requiring retry
    await queryRunner.createIndex(
      'provider_webhook_events',
      new TableIndex({
        name: 'IDX_webhook_events_retry',
        columnNames: ['processing_status', 'created_at'],
        where: "processing_status IN ('failed', 'retry_pending')",
      }),
    );

    // Index for retry scheduler to find webhooks by next_retry_at
    await queryRunner.createIndex(
      'provider_webhook_events',
      new TableIndex({
        name: 'IDX_webhook_events_next_retry',
        columnNames: ['retry_count', 'processing_status'],
        where: "processing_status IN ('failed', 'retry_pending')",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('provider_webhook_events', true);
  }
}
