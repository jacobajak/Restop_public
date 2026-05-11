import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCountryColumnsToTenants1712260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tenants');

    // Add country_code column
    if (!table?.findColumnByName('country_code')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'country_code',
          type: 'varchar',
          isNullable: true,
          comment: 'African country code (e.g., RW, KE, TZ, UG, GH)',
        }),
      );
    }

    // Add country_name column
    if (!table?.findColumnByName('country_name')) {
      await queryRunner.addColumn(
        'tenants',
        new TableColumn({
          name: 'country_name',
          type: 'varchar',
          isNullable: true,
          comment: 'Full country name (e.g., Rwanda, Kenya, Tanzania)',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tenants');

    if (table?.findColumnByName('country_code')) {
      await queryRunner.dropColumn('tenants', 'country_code');
    }

    if (table?.findColumnByName('country_name')) {
      await queryRunner.dropColumn('tenants', 'country_name');
    }
  }
}
