import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSuspensionColumnsToTenants1712192400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add suspended_reason column
    await queryRunner.addColumn(
      'tenants',
      new TableColumn({
        name: 'suspended_reason',
        type: 'text',
        isNullable: true,
        comment: 'Reason for suspension (if status = SUSPENDED)',
      }),
    );

    // Add suspended_at column
    await queryRunner.addColumn(
      'tenants',
      new TableColumn({
        name: 'suspended_at',
        type: 'timestamp',
        isNullable: true,
        comment: 'Timestamp when restaurant was suspended',
      }),
    );

    // Add suspended_by_admin_id column
    await queryRunner.addColumn(
      'tenants',
      new TableColumn({
        name: 'suspended_by_admin_id',
        type: 'uuid',
        isNullable: true,
        comment: 'Admin user ID who suspended this restaurant',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the columns if rolling back
    await queryRunner.dropColumn('tenants', 'suspended_by_admin_id');
    await queryRunner.dropColumn('tenants', 'suspended_at');
    await queryRunner.dropColumn('tenants', 'suspended_reason');
  }
}
