import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFraudReviewsTable1711900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'fraud_reviews',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'subject_type',
            type: 'enum',
            enum: ['ORDER', 'CUSTOMER', 'PAYMENT', 'REFUND', 'MERCHANT'],
            isNullable: false,
          },
          {
            name: 'subject_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'risk_score',
            type: 'smallint',
            default: 0,
            isNullable: false,
          },
          {
            name: 'risk_level',
            type: 'enum',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            isNullable: false,
          },
          {
            name: 'reasons_json',
            type: 'jsonb',
            isNullable: true,
            comment: 'Array of indicators and recommended action from FraudDetectionService',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['OPEN', 'UNDER_REVIEW', 'APPROVED', 'BLOCKED', 'DISMISSED', 'ESCALATED'],
            isNullable: false,
            default: "'OPEN'",
          },
          {
            name: 'assigned_admin_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'action_taken',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'customer_phone',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'payment_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'merchant_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 12,
            scale: 2,
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
          {
            name: 'reviewed_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['assigned_admin_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            columnNames: ['order_id'],
            referencedTableName: 'orders',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

    // Create indexes for common queries
    await queryRunner.createIndex(
      'fraud_reviews',
      new TableIndex({
        name: 'IDX_fraud_reviews_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'fraud_reviews',
      new TableIndex({
        name: 'IDX_fraud_reviews_risk_level',
        columnNames: ['risk_level'],
      }),
    );

    await queryRunner.createIndex(
      'fraud_reviews',
      new TableIndex({
        name: 'IDX_fraud_reviews_subject',
        columnNames: ['subject_type', 'subject_id'],
      }),
    );

    await queryRunner.createIndex(
      'fraud_reviews',
      new TableIndex({
        name: 'IDX_fraud_reviews_created_status',
        columnNames: ['created_at', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'fraud_reviews',
      new TableIndex({
        name: 'IDX_fraud_reviews_assigned_admin',
        columnNames: ['assigned_admin_id'],
      }),
    );

    // Index for queue filtering (open, high-risk items created recently)
    await queryRunner.createIndex(
      'fraud_reviews',
      new TableIndex({
        name: 'IDX_fraud_reviews_queue',
        columnNames: ['status', 'risk_level', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('fraud_reviews');
  }
}
