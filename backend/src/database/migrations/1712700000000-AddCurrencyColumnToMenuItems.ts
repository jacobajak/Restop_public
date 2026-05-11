import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCurrencyColumnToMenuItems1712700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('menu_items');
    
    // Check if currency column already exists
    const hasColumn = table?.columns.some((col) => col.name === 'currency');
    
    if (!hasColumn) {
      await queryRunner.addColumn(
        'menu_items',
        new TableColumn({
          name: 'currency',
          type: 'varchar',
          length: '3',
          isNullable: true,
          comment: 'Currency code (ISO 4217) for this menu item price (inherits from tenant if null)',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('menu_items');
    const hasColumn = table?.columns.some((col) => col.name === 'currency');
    
    if (hasColumn) {
      await queryRunner.dropColumn('menu_items', 'currency');
    }
  }
}
