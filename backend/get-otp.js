const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'restop_db',
  user: 'restop',
  password: 'restop_password'
});

async function main() {
  try {
    await client.connect();
    
    // First, get the table schema
    const columnsResult = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='auth_otp_challenges' ORDER BY ordinal_position"
    );
    
    console.log('Columns in auth_otp_challenges:');
    columnsResult.rows.forEach(col => console.log('  -', col.column_name));
    
    // Then query for the latest OTP
    const otpResult = await client.query(
      'SELECT * FROM auth_otp_challenges ORDER BY created_at DESC LIMIT 1'
    );
    
    if (otpResult.rows.length > 0) {
      console.log('\nLatest OTP Challenge:');
      console.log(JSON.stringify(otpResult.rows[0], null, 2));
    } else {
      console.log('No OTP challenges found');
    }
    
    await client.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
