const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'restop_db',
  user: 'restop',
  password: 'restop_password',
});

async function createTenant() {
  try {
    console.log('[Creating Test Restaurant & Owner...]');
    
    // Create test tenant
    const tenantResult = await pool.query(
      `INSERT INTO tenants (name, slug, email, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW()) 
       RETURNING id`,
      [
        'Test Restaurant',
        'test-restaurant-' + Date.now(),
        'testrest-' + Date.now() + '@example.com'
      ]
    );
    
    const tenantId = tenantResult.rows[0].id;
    console.log('✓ Tenant created:', tenantId);
    
    // Create test user
    const passwordHash = await bcrypt.hash('RestaurantPass123!', 10);
    await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [
        tenantId,
        'Test Owner',
        'testrest-' + Date.now() + '@example.com',
        passwordHash,
        'TENANT_OWNER'
      ]
    );
    
    console.log('✓ User created');
    
    console.log('\n✅ Test Restaurant Owner Account Ready!');
    console.log('═══════════════════════════════════════');
    console.log('  Email: testrest-' + Date.now() + '@example.com');
    console.log('  Password: RestaurantPass123!');
    console.log('  Role: TENANT_OWNER');
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createTenant();
