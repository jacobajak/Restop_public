#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';

async function updateLegacyQRCodes() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'restop',
    password: process.env.DB_PASSWORD || 'restop_password',
    database: process.env.DB_NAME || 'restop_db',
  });

  try {
    console.log('🔄 Starting QR code update...');
    console.log('📦 Connecting to database...');
    
    await client.connect();

    // Get the frontend URL from environment
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    console.log(`🌐 Using frontend URL: ${frontendUrl}\n`);

    // Get all tables with old QR code format or missing qr_url
    const res = await client.query(`
      SELECT 
        t.id, 
        t.table_number, 
        t.qr_code, 
        t.qr_url,
        te.slug
      FROM tables t
      LEFT JOIN tenants te ON t.tenant_id = te.id
      WHERE t.qr_code LIKE 'QR-TABLE-%'
         OR t.qr_url IS NULL
         OR t.qr_url NOT LIKE 'http%'
    `);

    const tables = res.rows;
    console.log(`📊 Found ${tables.length} table(s) to update\n`);

    let updated = 0;

    for (const table of tables) {
      // Generate new QR code format: 2-digit table number + 4 hex chars from table UUID
      const paddedTableNum = table.table_number.toString().padStart(2, '0');
      const randomHex = table.id.substring(0, 4).toUpperCase(); // Use first 4 chars of UUID
      const newQRCode = `${paddedTableNum}${randomHex}`;

      // Generate full QR URL that works when scanned from mobile devices
      const qrUrl = `${frontendUrl}/menu/${table.slug}?table=${table.table_number}&tableId=${table.id}`;

      // Update the table
      await client.query(
        'UPDATE tables SET qr_code = $1, qr_url = $2 WHERE id = $3',
        [newQRCode, qrUrl, table.id],
      );

      console.log(
        `✅ Table ${table.table_number}: ${table.qr_code || 'no code'} → ${newQRCode}`,
      );
      console.log(`   URL: ${qrUrl}\n`);
      updated++;
    }

    console.log(`✨ Successfully updated ${updated} table(s)`);

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating QR codes:', error);
    process.exit(1);
  }
}

updateLegacyQRCodes();
