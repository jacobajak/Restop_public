import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateNotificationHistoryTable1710000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notification_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'recipient_email',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'notification_type',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'channel',
            type: 'varchar',
            isNullable: false,
            default: "'EMAIL'",
          },
          {
            name: 'status',
            type: 'varchar',
            isNullable: false,
            default: "'PENDING'",
          },
          {
            name: 'related_entity_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'related_entity_type',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'subject',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'html_content',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'attempt_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'max_attempts',
            type: 'integer',
            default: 5,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sent_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_retry_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'next_retry_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'template_variables',
            type: 'jsonb',
            isNullable: true,
            default: "'{}'",
          },
          {
            name: 'provider_response',
            type: 'jsonb',
            isNullable: true,
            default: "'{}'",
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
        foreignKeys: [
          {
            columnNames: ['tenant_id'],
            referencedTableName: 'tenants',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    // Create indexes for performance
    await queryRunner.createIndex(
      'notification_history',
      new TableIndex({
        name: 'IDX_notification_history_deduplication',
        columnNames: ['idempotency_key'],
        isUnique: true,
        where: 'idempotency_key IS NOT NULL',
      }),
    );

    await queryRunner.createIndex(
      'notification_history',
      new TableIndex({
        name: 'IDX_notification_history_tenant_created',
        columnNames: ['tenant_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'notification_history',
      new TableIndex({
        name: 'IDX_notification_history_entity',
        columnNames: ['related_entity_id', 'notification_type'],
      }),
    );

    await queryRunner.createIndex(
      'notification_history',
      new TableIndex({
        name: 'IDX_notification_history_retry',
        columnNames: ['status', 'next_retry_at'],
        where: "status IN ('FAILED', 'RETRYING')",
      }),
    );

    await queryRunner.createIndex(
      'notification_history',
      new TableIndex({
        name: 'IDX_notification_history_email_type',
        columnNames: ['recipient_email', 'notification_type', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notification_history', true);
  }
}
