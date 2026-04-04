import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTableQRCodes1710553201000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // This migration updates all existing tables to use the new QR code format
    // New format: {2-digit table number}{4 hex chars from table ID}
    // Example: "05DC4" instead of "QR-TABLE-XXXXXXXX"

    // Get all tables that still have the old QR code format
    const tables = await queryRunner.query(`
      SELECT t.id, t.table_number, t.qr_code, te.slug
      FROM tables t
      LEFT JOIN tenants te ON t.tenant_id = te.id
      WHERE t.qr_code LIKE 'QR-TABLE-%'
        OR t.qr_url IS NULL
    `);

    // Update each table
    for (const table of tables) {
      // Generate new QR code format: 2-digit table number + 4 hex chars from table UUID
      const paddedTableNum = table.table_number.toString().padStart(2, '0');
      const randomHex = table.id.substring(0, 4).toUpperCase(); // Use first 4 chars of UUID
      const newQRCode = `${paddedTableNum}${randomHex}`;

      // Generate QR URL pointing to the menu
      const qrUrl = `/menu/${table.slug}?table=${table.table_number}&tableId=${table.id}`;

      // Update the table
      await queryRunner.query(
        `UPDATE tables SET qr_code = $1, qr_url = $2 WHERE id = $3`,
        [newQRCode, qrUrl, table.id],
      );

      console.log(
        `Updated Table ${table.table_number}: QR code changed to ${newQRCode}`,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Rollback: This would be complex as we'd lose the original QR code data
    // For now, just skip the rollback
    console.log(
      'Rollback not supported for UpdateTableQRCodes - manual intervention required',
    );
  }
}
