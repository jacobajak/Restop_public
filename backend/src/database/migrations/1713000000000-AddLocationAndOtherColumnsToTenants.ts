import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLocationAndOtherColumnsToTenants1713000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('tenants');
    if (!tableExists) {
      console.warn('tenants table does not exist, skipping migration');
      return;
    }

    const table = await queryRunner.getTable('tenants');

    // Add location column
    if (!table.findColumnByName('location')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'location',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }

    // Add slug column
    if (!table.findColumnByName('slug')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'slug',
          type: 'varchar',
          length: '255',
          isNullable: true,
          isUnique: true,
        }),
      );
    }

    // Add logo_url column
    if (!table.findColumnByName('logo_url')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'logo_url',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }

    // Add currency column
    if (!table.findColumnByName('currency')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'currency',
          type: 'varchar',
          length: '10',
          default: "'RWF'",
          isNullable: true,
        }),
      );
    }

    // Add country_code column
    if (!table.findColumnByName('country_code')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'country_code',
          type: 'varchar',
          length: '10',
          isNullable: true,
        }),
      );
    }

    // Add country_name column
    if (!table.findColumnByName('country_name')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'country_name',
          type: 'varchar',
          length: '100',
          isNullable: true,
        }),
      );
    }

    // Add qr_code_url column
    if (!table.findColumnByName('qr_code_url')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'qr_code_url',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }

    // Add qr_code_data column
    if (!table.findColumnByName('qr_code_data')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'qr_code_data',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    // Add archived_at column
    if (!table.findColumnByName('archived_at')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'archived_at',
          type: 'timestamp',
          isNullable: true,
        }),
      );
    }

    // Add archived_by_admin_id column
    if (!table.findColumnByName('archived_by_admin_id')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'archived_by_admin_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('tenants');
    if (!tableExists) {
      return;
    }

    // Drop columns in reverse order
    await queryRunner.dropColumn('tenants', 'archived_by_admin_id');
    await queryRunner.dropColumn('tenants', 'archived_at');
    await queryRunner.dropColumn('tenants', 'qr_code_data');
    await queryRunner.dropColumn('tenants', 'qr_code_url');
    await queryRunner.dropColumn('tenants', 'country_name');
    await queryRunner.dropColumn('tenants', 'country_code');
    await queryRunner.dropColumn('tenants', 'currency');
    await queryRunner.dropColumn('tenants', 'logo_url');
    await queryRunner.dropColumn('tenants', 'slug');
    await queryRunner.dropColumn('tenants', 'location');
  }
}
