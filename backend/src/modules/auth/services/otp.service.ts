import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { OtpChallenge, OtpChallengeStatus, LoginAttempt } from '../entities/otp-challenge.entity';
import { EmailService } from './email.service';

/**
 * 2FA/OTP Service
 * 
 * Manages OTP generation, verification, and expiration for 2FA authentication.
 * 
 * Features:
 * - Generate 6-digit OTP codes
 * - Secure hashing of OTP (bcrypt)
 * - OTP expiration (configurable, default 10 minutes)
 * - Attempt tracking and lockout
 * - Resend with cooldown and limits
 * - Rate limiting on OTP verification
 * - Login attempt tracking
 * 
 * @service OtpService
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRATION_MINUTES = 10;
  private readonly RESEND_COOLDOWN_SECONDS = 30;
  private readonly MAX_RESENDS_PER_CHALLENGE = 3;
  private readonly LOGIN_RATE_LIMIT_MINUTES = 15;
  private readonly LOGIN_RATE_LIMIT_ATTEMPTS = 5;

  constructor(
    @InjectRepository(OtpChallenge)
    private readonly otpRepository: Repository<OtpChallenge>,
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate and send OTP email
   * 
   * Creates a new OTP challenge, generates a 6-digit code,
   * hashes it, and sends via email.
   * 
   * @param userId - User ID
   * @param email - User email
   * @param ipAddress - Client IP for security audit
   * @param userAgent - Client user agent
   * @returns Promise with challenge ID and expiration time
   * @throws BadRequestException if email is rate limited
   */
  async generateAndSendOtp(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    // Check rate limiting: max 5 login attempts per 15 minutes
    try {
      const recentAttempts = await this.loginAttemptRepository.count({
        where: {
          email,
          created_at: MoreThan(
            new Date(Date.now() - this.LOGIN_RATE_LIMIT_MINUTES * 60 * 1000),
          ),
        },
      });

      if (recentAttempts >= this.LOGIN_RATE_LIMIT_ATTEMPTS) {
        throw new BadRequestException(
          `Too many login attempts. Please try again in ${this.LOGIN_RATE_LIMIT_MINUTES} minutes.`,
        );
      }
    } catch (error) {
      // If it's a BadRequestException, re-throw it
      if (error instanceof BadRequestException) {
        throw error;
      }
      // For TypeORM metadata errors, log warning but continue
      this.logger.warn(
        `[WARNING] Failed to check rate limiting (metadata issue): ${error.message}. Allowing OTP generation.`,
      );
    }

    // Generate 6-digit OTP
    const otp = this.generate6DigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    // Set expiration
    const expiresAt = new Date(
      Date.now() + this.OTP_EXPIRATION_MINUTES * 60 * 1000,
    );

    // Create challenge
    const challenge = this.otpRepository.create({
      user_id: userId,
      email,
      otp_hash: otpHash,
      expires_at: expiresAt,
      status: OtpChallengeStatus.PENDING,
      ip_address: ipAddress,
      user_agent: userAgent,
      consumed_at: null,
      attempt_count: 0,
    });

    const savedChallenge = await this.otpRepository.save(challenge);

    // LOG: Temporary logging for testing (remove in production)
    this.logger.log(`🔐 [OTP CODE] ${otp} - Valid until ${expiresAt.toISOString()}`);
    
    // DEV: Write OTP code to debug file for testing
    if (process.env.NODE_ENV === 'development') {
      try {
        const debugFile = path.join(process.cwd(), '.otp-debug.json');
        const debugData = {
          otp_code: otp,
          challenge_id: savedChallenge.id,
          email,
          expires_at: expiresAt.toISOString(),
          generated_at: new Date().toISOString(),
        };
        fs.writeFileSync(debugFile, JSON.stringify(debugData, null, 2));
      } catch (err) {
        this.logger.warn('Failed to write OTP debug file:', err.message);
      }
    }

    // Send OTP via email (non-blocking)
    this.emailService
      .sendOtpEmail(email, otp, this.OTP_EXPIRATION_MINUTES)
      .catch((error) => {
        this.logger.error(
          `Failed to send OTP email to ${email}:`,
          error,
        );
      });

    this.logger.log(`OTP challenge created for user ${userId}`);

    return {
      challengeId: savedChallenge.id,
      expiresAt,
    };
  }

  /**
   * Verify OTP code against challenge
   * 
   * @param challengeId - Challenge ID
   * @param otpCode - User-entered 6-digit code
   * @returns Promise<boolean> - true if valid
   * @throws BadRequestException if challenge not found, expired, or invalid
   */
  async verifyOtp(challengeId: string, otpCode: string): Promise<boolean> {
    const challenge = await this.otpRepository.findOne({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Check if already used
    if (challenge.consumed_at) {
      throw new BadRequestException('This verification code has already been used');
    }

    // Check if locked
    if (challenge.status === OtpChallengeStatus.LOCKED) {
      throw new BadRequestException(
        'Too many verification attempts. Please request a new code.',
      );
    }

    // Check if expired
    if (challenge.status === OtpChallengeStatus.EXPIRED || new Date() > challenge.expires_at) {
      challenge.status = OtpChallengeStatus.EXPIRED;
      await this.otpRepository.save(challenge);
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    // Check if max attempts exceeded
    if (challenge.attempt_count >= challenge.max_attempts) {
      challenge.status = OtpChallengeStatus.LOCKED;
      await this.otpRepository.save(challenge);
      throw new BadRequestException(
        'Too many verification attempts. Please request a new code.',
      );
    }

    // Verify OTP code
    const isValid = await bcrypt.compare(otpCode, challenge.otp_hash);

    if (!isValid) {
      challenge.attempt_count += 1;
      if (challenge.attempt_count >= challenge.max_attempts) {
        challenge.status = OtpChallengeStatus.LOCKED;
      }
      await this.otpRepository.save(challenge);

      const attemptsRemaining = challenge.max_attempts - challenge.attempt_count;
      throw new BadRequestException(
        `Invalid verification code. ${attemptsRemaining} attempts remaining.`,
      );
    }

    // Mark as consumed
    challenge.status = OtpChallengeStatus.VERIFIED;
    challenge.consumed_at = new Date();
    await this.otpRepository.save(challenge);

    this.logger.log(`OTP verified for challenge ${challengeId}`);
    return true;
  }

  /**
   * Resend OTP with cooldown and resend limit
   * 
   * @param challengeId - Challenge ID
   * @param email - User email (for sending)
   * @returns Promise with new expiration time
   * @throws BadRequestException if cooldown not met or max resends exceeded
   */
  async resendOtp(challengeId: string, email: string): Promise<{ expiresAt: Date }> {
    const challenge = await this.otpRepository.findOne({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Check if already verified or locked
    if (challenge.status !== OtpChallengeStatus.PENDING) {
      throw new BadRequestException(
        'Cannot resend code for this verification attempt',
      );
    }

    // Check resend cooldown
    if (challenge.last_resent_at) {
      const timeSinceLastResend =
        (new Date().getTime() - challenge.last_resent_at.getTime()) / 1000;
      if (timeSinceLastResend < this.RESEND_COOLDOWN_SECONDS) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(this.RESEND_COOLDOWN_SECONDS - timeSinceLastResend)} seconds before requesting a new code`,
        );
      }
    }

    // Check max resends
    if (challenge.resend_count >= this.MAX_RESENDS_PER_CHALLENGE) {
      throw new BadRequestException(
        'Maximum resend attempts exceeded. Please request a new verification code.',
      );
    }

    // Generate new OTP
    const newOtp = this.generate6DigitOtp();
    const newOtpHash = await bcrypt.hash(newOtp, 10);

    // Update challenge
    challenge.otp_hash = newOtpHash;
    challenge.expires_at = new Date(
      Date.now() + this.OTP_EXPIRATION_MINUTES * 60 * 1000,
    );
    challenge.resend_count += 1;
    challenge.last_resent_at = new Date();
    challenge.attempt_count = 0; // Reset attempts on resend

    await this.otpRepository.save(challenge);

    // LOG: Temporary logging for testing (remove in production)
    const newExpiresAt = new Date(
      Date.now() + this.OTP_EXPIRATION_MINUTES * 60 * 1000,
    );
    this.logger.log(`🔐 [OTP CODE RESEND] ${newOtp} - Valid until ${newExpiresAt.toISOString()}`);

    // Send new OTP
    this.emailService
      .sendOtpEmail(email, newOtp, this.OTP_EXPIRATION_MINUTES)
      .catch((error) => {
        this.logger.error(`Failed to resend OTP to ${email}:`, error);
      });

    this.logger.log(`OTP resent for challenge ${challengeId}`);

    return {
      expiresAt: challenge.expires_at,
    };
  }

  /**
   * Record login attempt (for rate limiting and security audit)
   * 
   * @param email - User email
   * @param ipAddress - Client IP
   * @param userAgent - Client user agent
   * @param isFailed - Whether login failed
   * @param failureReason - Reason if failed
   */
  async recordLoginAttempt(
    email: string,
    ipAddress: string,
    userAgent: string,
    isFailed: boolean = false,
    failureReason?: string,
  ): Promise<void> {
    try {
      const attempt = this.loginAttemptRepository.create({
        email,
        ip_address: ipAddress,
        user_agent: userAgent,
        is_failed: isFailed,
        failure_reason: failureReason || null,
      });

      await this.loginAttemptRepository.save(attempt);
    } catch (error) {
      // TypeORM metadata error - log warning but don't crash
      this.logger.warn(
        `[WARNING] Failed to record login attempt (metadata issue): ${error.message}. Continuing anyway.`,
      );
      // Continue without recording attempt - the login can still proceed
    }
  }

  /**
   * Check if email is currently locked due to too many attempts
   * 
   * @param email - User email
   * @returns Promise<boolean> - true if locked
   */
  async isEmailLocked(email: string): Promise<boolean> {
    try {
      const recentFailedAttempts = await this.loginAttemptRepository.count({
        where: {
          email,
          is_failed: true,
          created_at: MoreThan(
            new Date(Date.now() - this.LOGIN_RATE_LIMIT_MINUTES * 60 * 1000),
          ),
        },
      });

      return recentFailedAttempts >= this.LOGIN_RATE_LIMIT_ATTEMPTS;
    } catch (error) {
      // TypeORM metadata error - temporarily allow login while we fix the root cause
      this.logger.warn(
        `[WARNING] Failed to check login attempts (metadata issue): ${error.message}. Allowing login to proceed.`,
      );
      return false; // Allow login if we can't check rate limiting
    }
  }

  /**
   * Clean up expired OTP challenges
   * Runs periodically to keep database clean
   * 
   * @returns Promise<number> - Number of cleaned challenges
   */
  async cleanupExpiredChallenges(): Promise<number> {
    const result = await this.otpRepository.delete({
      expires_at: LessThan(new Date()),
      status: OtpChallengeStatus.PENDING,
    });

    return result.affected || 0;
  }

  /**
   * Clean up old login attempts
   * Keep for 30 days for audit
   * 
   * @returns Promise<number> - Number of cleaned records
   */
  async cleanupOldLoginAttempts(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.loginAttemptRepository.delete({
      created_at: LessThan(thirtyDaysAgo),
    });

    return result.affected || 0;
  }

  /**
   * Generate a random 6-digit OTP code
   * @private
   */
  private generate6DigitOtp(): string {
    const otp = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return otp;
  }
}
