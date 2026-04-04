import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSuspensionColumnsToTenants1712192400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('tenants');
    if (!tableExists) {
      console.warn('tenants table does not exist, skipping migration');
      return;
    }

    // Check if columns already exist and add only if they don't
    const table = await queryRunner.getTable('tenants');

    if (!table.findColumnByName('suspended_reason')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'suspended_reason',
          type: 'text',
          isNullable: true,
          comment: 'Reason for suspension (if status = SUSPENDED)',
        }),
      );
    }

    if (!table.findColumnByName('suspended_at')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'suspended_at',
          type: 'timestamp',
          isNullable: true,
          comment: 'Timestamp when restaurant was suspended',
        }),
      );
    }

    if (!table.findColumnByName('suspended_by_admin_id')) {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('tenants');
    if (!tableExists) {
      return;
    }

    const table = await queryRunner.getTable('tenants');

    if (table.findColumnByName('suspended_by_admin_id')) {
      await queryRunner.dropColumn('tenants', 'suspended_by_admin_id');
    }

    if (table.findColumnByName('suspended_at')) {
      await queryRunner.dropColumn('tenants', 'suspended_at');
    }

    if (table.findColumnByName('suspended_reason')) {
      await queryRunner.dropColumn('tenants', 'suspended_reason');
    }
  }
}
