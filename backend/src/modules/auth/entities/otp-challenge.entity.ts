import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OtpChallengeStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  LOCKED = 'LOCKED',
}

/**
 * OTP Challenge Entity
 * 
 * Stores one-time password challenges for 2FA authentication.
 * Each login attempt creates a challenge that must be verified
 * with a 6-digit OTP before granting access.
 * 
 * Features:
 * - Hashed OTP storage (never store plain text)
 * - Automatic expiration (5-10 minutes)
 * - Attempt tracking and lockout
 * - IP and user agent logging for security audit
 * - Single-use constraint via consumed_at
 * 
 * @entity auth_otp_challenges
 */
@Entity('auth_otp_challenges')
@Index(['user_id', 'status']) // For finding active challenges
@Index(['email', 'created_at']) // For rate limiting queries
export class OtpChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column()
  email: string;

  /**
   * Hashed OTP code (bcrypt hash of 6-digit code)
   * Never store raw OTP
   */
  @Column()
  otp_hash: string;

  /**
   * When this OTP expires (typically 5-10 minutes after creation)
   */
  @Column()
  expires_at: Date;

  /**
   * When OTP was actually verified (null if not yet verified)
   */
  @Column({ nullable: true })
  consumed_at: Date | null;

  /**
   * Number of failed verification attempts
   */
  @Column({ default: 0 })
  attempt_count: number;

  /**
   * Maximum allowed attempts before lockout
   */
  @Column({ default: 5 })
  max_attempts: number;

  /**
   * Current status of challenge
   * PENDING: Waiting for OTP verification
   * VERIFIED: OTP was successfully verified
   * EXPIRED: Expiration time passed
   * LOCKED: Too many failed attempts
   */
  @Column({
    enum: OtpChallengeStatus,
    type: 'enum',
    default: OtpChallengeStatus.PENDING,
  })
  status: OtpChallengeStatus;

  /**
   * IP address of the login attempt (for security audit)
   */
  @Column({ nullable: true })
  ip_address: string | null;

  /**
   * User agent of the login attempt (for security audit)
   */
  @Column({ nullable: true })
  user_agent: string | null;

  /**
   * Number of times OTP was resent
   */
  @Column({ default: 0 })
  resend_count: number;

  /**
   * Last time OTP was resent
   */
  @Column({ nullable: true })
  last_resent_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Login Attempt Entity
 * 
 * Tracks failed login attempts for rate limiting and
 * suspicious activity detection.
 * 
 * @entity login_attempts
 */
@Entity('login_attempts')
@Index(['email', 'created_at']) // For rate limiting
@Index(['ip_address', 'created_at']) // For brute force detection
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  /**
   * IP address of login attempt
   */
  @Column()
  ip_address: string;

  /**
   * User agent of login attempt
   */
  @Column()
  user_agent: string;

  /**
   * true if login failed, false if successful
   */
  @Column({ default: true })
  is_failed: boolean;

  /**
   * Reason for failure (invalid_credentials, locked_out, etc.)
   */
  @Column({ nullable: true })
  failure_reason: string | null;

  /**
   * Geographic location (optional, for future use)
   */
  @Column({ nullable: true })
  location: string | null;

  @CreateDateColumn()
  created_at: Date;
}
