import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddArchiveColumnsToTenants1712250000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns already exist to prevent duplicate column errors
    const table = await queryRunner.getTable('tenants');
    
    if (table && !table.findColumnByName('archived_at')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'archived_at',
          type: 'timestamp',
          isNullable: true,
          comment: 'Timestamp when restaurant was archived (soft delete)',
        })
      );
    }

    if (table && !table.findColumnByName('archived_by_admin_id')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'archived_by_admin_id',
          type: 'uuid',
          isNullable: true,
          comment: 'Admin user ID who archived this restaurant',
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the columns if rolling back
    const table = await queryRunner.getTable('tenants');
    
    if (table && table.findColumnByName('archived_at')) {
      await queryRunner.dropColumn('tenants', 'archived_at');
    }

    if (table && table.findColumnByName('archived_by_admin_id')) {
      await queryRunner.dropColumn('tenants', 'archived_by_admin_id');
    }
  }
}
