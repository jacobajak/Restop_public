import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateOtpAndLoginAttemptTables1711900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create auth_otp_challenges table for 2FA OTP storage
    await queryRunner.createTable(
      new Table({
        name: 'auth_otp_challenges',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'otp_hash',
            type: 'varchar',
            isNullable: false,
            comment: 'Bcrypt hashed OTP (never store plaintext)',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: false,
            comment: 'OTP expiration time (typically 5-10 minutes)',
          },
          {
            name: 'consumed_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'When OTP was verified (null if not yet)',
          },
          {
            name: 'attempt_count',
            type: 'int',
            default: 0,
            isNullable: false,
            comment: 'Number of failed verification attempts',
          },
          {
            name: 'max_attempts',
            type: 'int',
            default: 5,
            isNullable: false,
            comment: 'Maximum failed attempts before lockout',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED'],
            default: "'PENDING'",
            isNullable: false,
            comment: 'Challenge status: PENDING, VERIFIED, EXPIRED, or LOCKED',
          },
          {
            name: 'ip_address',
            type: 'varchar',
            isNullable: true,
            comment: 'Client IP address for security audit',
          },
          {
            name: 'user_agent',
            type: 'varchar',
            isNullable: true,
            comment: 'Client user agent for browser fingerprinting',
          },
          {
            name: 'resend_count',
            type: 'int',
            default: 0,
            isNullable: false,
            comment: 'Number of times OTP was resent',
          },
          {
            name: 'last_resent_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Last time OTP was resent (for cooldown enforcement)',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'fk_otp_challenge_user',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create indexes for OtpChallenge table
    await queryRunner.createIndex(
      'auth_otp_challenges',
      new TableIndex({
        name: 'idx_otp_user_status',
        columnNames: ['user_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'auth_otp_challenges',
      new TableIndex({
        name: 'idx_otp_email_created',
        columnNames: ['email', 'created_at'],
      }),
    );

    // Create login_attempts table for rate limiting and brute force detection
    await queryRunner.createTable(
      new Table({
        name: 'login_attempts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'email',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            isNullable: false,
            comment: 'Client IP address for rate limiting',
          },
          {
            name: 'user_agent',
            type: 'varchar',
            isNullable: false,
            comment: 'Client user agent',
          },
          {
            name: 'is_failed',
            type: 'boolean',
            default: true,
            isNullable: false,
            comment: 'true if login failed, false if successful',
          },
          {
            name: 'failure_reason',
            type: 'varchar',
            isNullable: true,
            comment: 'Reason for failure: invalid_credentials, locked_out, etc.',
          },
          {
            name: 'location',
            type: 'varchar',
            isNullable: true,
            comment: 'Geographic location (optional, for future use)',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
    );

    // Create indexes for LoginAttempt table
    await queryRunner.createIndex(
      'login_attempts',
      new TableIndex({
        name: 'idx_login_email_created',
        columnNames: ['email', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'login_attempts',
      new TableIndex({
        name: 'idx_login_ip_created',
        columnNames: ['ip_address', 'created_at'],
      }),
    );

    console.log(
      'Created auth_otp_challenges and login_attempts tables for 2FA security',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop login_attempts table first (no foreign keys)
    await queryRunner.dropTable('login_attempts');

    // Drop auth_otp_challenges table
    await queryRunner.dropTable('auth_otp_challenges');

    console.log('Dropped auth_otp_challenges and login_attempts tables');
  }
}
