const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  user: 'restop',
  password: 'restop_password',
  host: 'localhost',
  port: 5432,
  database: 'restop_db',
});

async function deleteAndCreateAdmin() {
  try {
    // Delete existing admin user if exists
    await pool.query(
      'DELETE FROM users WHERE email = $1',
      ['admin@platform.local']
    );
    console.log('✓ Deleted existing admin user (if any)');
    
    // Hash the password with 10 salt rounds (matching the app config)
    const password = 'AdminPassword123!';
    const password_hash = await bcrypt.hash(password, 10);
    
    console.log(`✓ Hashed password: ${password_hash}`);
    
    // Insert the admin user
    const query = `
      INSERT INTO users (id, tenant_id, name, email, password_hash, role, created_at, updated_at)
      VALUES (gen_random_uuid(), NULL, 'Platform Admin', 'admin@platform.local', $1, $2, NOW(), NOW())
      RETURNING id, email, role;
    `;
    
    const result = await pool.query(query, [password_hash, 'PLATFORM_ADMIN']);
    
    console.log('\n✅ Admin user created successfully!');
    console.log('User ID:', result.rows[0].id);
    console.log('Email:', result.rows[0].email);
    console.log('Role:', result.rows[0].role);
    console.log('\nYou can now login with:');
    console.log('  Email: admin@platform.local');
    console.log('  Password:', password);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteAndCreateAdmin();
