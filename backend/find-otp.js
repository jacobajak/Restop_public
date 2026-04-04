const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function findOTP() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'restop_db',
    user: 'restop',
    password: 'restop_password'
  });

  try {
    await client.connect();
    
    // Get the latest OTP challenge
    const result = await client.query(
      'SELECT id, otp_hash, created_at FROM auth_otp_challenges ORDER BY created_at DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.log('No OTP challenges found');
      await client.end();
      return;
    }
    
    const challenge = result.rows[0];
    console.log(`\nSearching for OTP for challenge: ${challenge.id}`);
    console.log(`Created at: ${challenge.created_at}`);
    console.log('Testing codes...\n');
    
    let found = false;
    
    // Test all 6-digit codes
    for (let code = 0; code <= 999999; code++) {
      const otpCode = String(code).padStart(6, '0');
      
      try {
        const isMatch = await bcrypt.compare(otpCode, challenge.otp_hash);
        if (isMatch) {
          console.log(`\n✅ FOUND OTP CODE: ${otpCode}\n`);
          found = true;
          break;
        }
      } catch (err) {
        console.error('bcrypt error:', err.message);
        break;
      }
      
      // Show progress every 100,000 codes
      if ((code + 1) % 100000 === 0) {
        console.log(`Tested ${code + 1}/1000000 codes...`);
      }
    }
    
    if (!found) {
      console.log('OTP code not found after testing all 1,000,000 codes');
    }
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

findOTP();
