import { IsString, IsEmail, Length, IsUUID } from 'class-validator';

/**
 * Verify OTP DTO
 * 
 * Request body for POST /auth/verify-otp endpoint.
 * User submits the 6-digit OTP they received via email
 * along with the challenge ID from initial login.
 */
export class VerifyOtpDto {
  /**
   * Challenge ID from initial login response
   */
  @IsUUID()
  challenge_id: string;

  /**
   * 6-digit OTP code entered by user
   */
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp_code: string;
}

/**
 * Resend OTP DTO
 * 
 * Request body for POST /auth/resend-otp endpoint.
 * User can request a new OTP if they didn't receive the original
 * or if it expired.
 */
export class ResendOtpDto {
  /**
   * Challenge ID from initial login response
   */
  @IsUUID()
  challenge_id: string;

  /**
   * User email (for resending to correct address)
   */
  @IsEmail()
  email: string;
}

/**
 * 2FA Login Response DTO
 * 
 * Response from POST /auth/login when 2FA is required.
 * Client must use challenge_id and email to verify OTP.
 */
export class TwoFactorLoginResponseDto {
  success: boolean;
  requires_2fa: boolean;
  challenge_id: string;
  email: string;
  expires_at: Date;
  message: string;
}

/**
 * OTP Verification Success Response DTO
 * 
 * Response from POST /auth/verify-otp when OTP is valid.
 * Contains final JWT token for authenticated access.
 */
export class OtpVerificationResponseDto {
  success: boolean;
  data: {
    access_token: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      tenant_id: string | null;
      slug?: string;
    };
  };
}
