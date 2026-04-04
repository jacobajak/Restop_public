/**
 * Authentication Controller
 * 
 * Handles HTTP endpoints for authentication operations:
 * - User login with credentials
 * - User registration with role assignment
 * - Token refresh for session continuation
 * - Logout (stateless; primarily for client cleanup)
 * 
 * All endpoints return JSON with standard response format:
 * {
 *   success: boolean,
 *   data: ResponseData
 * }
 * 
 * @controller /auth
 * @module AuthModule
 */

import { Controller, Post, Body, HttpCode, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto, ResendOtpDto } from './dto/2fa.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { Request } from 'express';

/**
 * Authentication endpoints router
 * 
 * @class AuthController
 * @route /api/v1/auth (with API prefix)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * 
   * Step 1 of 2FA: Authenticate user with email and password
   * 
   * NEW FLOW (with 2FA):
   * 1. User sends email and password
   * 2. Backend validates credentials
   * 3. Backend generates OTP and sends via email
   * 4. Returns challenge_id (NOT JWT token)
   * 5. User must call /auth/verify-otp with OTP code to get JWT token
   * 
   * @async
   * @param {LoginDto} loginDto - Email and password credentials
   * @param {Request} req - Express request (extracts IP and user agent)
   * @returns {Object} { success: true, requires_2fa: true, challenge_id, email, expires_at }
   * @status 200 - Login credentials valid, OTP sent
   * @status 401 - Invalid credentials
   * @status 429 - Too many attempts
   * 
   * @example
   * POST /api/v1/auth/login
   * {
   *   "email": "user@example.com",
   *   "password": "password123"
   * }
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "requires_2fa": true,
   *   "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
   *   "email": "user@example.com",
   *   "expires_at": "2026-03-31T14:35:00Z",
   *   "message": "OTP sent to your email. Please verify to continue."
   * }
   */
  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    // Extract IP address (handle proxies: X-Forwarded-For, X-Real-IP)
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      'unknown';

    // Extract user agent
    const userAgent = (req.headers['user-agent'] || 'unknown') as string;

    const response = await this.authService.login(
      loginDto,
      ipAddress,
      userAgent,
    );

    return response;
  }

  /**
   * POST /auth/verify-otp
   * 
   * Step 2 of 2FA: Verify OTP code and issue JWT token
   * 
   * FLOW:
   * 1. User submits challenge_id and 6-digit OTP code
   * 2. Backend validates OTP (must match, not expired, not attempted too many times)
   * 3. Backend issues JWT token for authenticated access
   * 4. User can now make authenticated API calls
   * 
   * Validation Rules:
   * - OTP must be exactly 6 digits
   * - OTP must be valid (matches hash stored during login)
   * - OTP must not be expired (10 minute window)
   * - Max 5 failed attempts before challenge locked
   * - Each failed attempt requires new challenge via /login again
   * 
   * @async
   * @param {VerifyOtpDto} dto - Challenge ID and OTP code
   * @returns {Object} { success: true, data: { access_token, user } }
   * @status 200 - OTP valid, JWT token issued
   * @status 400 - Invalid challenge or OTP code
   * @status 404 - Challenge not found or expired
   * 
   * @example
   * POST /api/v1/auth/verify-otp
   * {
   *   "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
   *   "otp_code": "123456"
   * }
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "data": {
   *     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *     "user": {
   *       "id": "user-123",
   *       "email": "user@example.com",
   *       "name": "John Doe",
   *       "role": "TENANT_OWNER",
   *       "tenant_id": "restaurant-456"
   *     }
   *   }
   * }
   */
  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const response = await this.authService.verifyOtp(dto);
    return {
      success: true,
      data: response,
    };
  }

  /**
   * POST /auth/resend-otp
   * 
   * Resend OTP code if user didn't receive it or if it expired
   * 
   * Rules:
   * - Cannot resend more than 3 times per challenge
   * - Must wait 30 seconds between resend attempts
   * - Challenge must still be PENDING (not already verified or expired)
   * - Resets failed attempt counter on successful resend
   * 
   * @async
   * @param {ResendOtpDto} dto - Challenge ID and email
   * @returns {Object} { success: true, expires_at }
   * @status 200 - OTP resent successfully
   * @status 400 - Cannot resend (challenge invalid, max resends exceeded)
   * @status 429 - Too soon (must wait 30 seconds)
   * 
   * @example
   * POST /api/v1/auth/resend-otp
   * {
   *   "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
   *   "email": "user@example.com"
   * }
   * 
   * Response (200):
   * {
   *   "success": true,
   *   "expires_at": "2026-03-31T14:35:00Z"
   * }
   */
  @Post('resend-otp')
  @HttpCode(200)
  async resendOtp(@Body() dto: ResendOtpDto) {
    const response = await this.authService.resendOtp(dto);
    return {
      success: true,
      data: response,
    };
  }

  /**
   * POST /auth/register
   * 
   * Create new user account
   * 
   * Supports registering users with different roles:
   * - PLATFORM_ADMIN: System administrator (no tenant)
   * - TENANT_OWNER: Restaurant owner (creates new tenant)
   * - TENANT_STAFF: Restaurant staff (assigned to existing tenant)
   * 
   * @async
   * @param {RegisterDto} registerDto - User details and optional tenant info
   * @returns {Object} { success: true, data: { access_token, user } }
   * @status 201 - Created successfully
   * @status 400 - Validation error or email already exists
   * 
   * @example
   * POST /api/v1/auth/register
   * {
   *   "email": "owner@pizza.com",
   *   "password": "securePassword123",
   *   "name": "John Owner",
   *   "role": "TENANT_OWNER",
   *   "tenant_name": "Best Pizza Co",
   *   "tenant_slug": "best-pizza-co"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "access_token": "eyJhbG...",
   *     "user": { ... }
   *   }
   * }
   */
  @Post('register')
  @HttpCode(201) // Return 201 Created status
  async register(@Body() registerDto: RegisterDto) {
    const response = await this.authService.register(registerDto);
    return {
      success: true,
      data: response,
    };
  }

  /**
   * POST /auth/refresh
   * 
   * Refresh expired JWT token
   * 
   * Requires valid JWT token in Authorization header.
   * Returns new token with fresh expiration time.
   * 
   * Required:
   * - Authorization header with Bearer token
   * - Token must be valid (not tampered with)
   * 
   * @async
   * @param {Request} req - Express request with user from JWT (injected by JwtAuthGuard)
   * @returns {Object} { success: true, data: { access_token, user } }
   * @status 200 - Token refreshed successfully
   * @status 401 - No token or invalid token
   * 
   * @guard JwtAuthGuard - Validates JWT and extracts user info
   * 
   * @example
   * POST /api/v1/auth/refresh
   * Authorization: Bearer eyJhbG...
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "access_token": "newTokenXYZ...",
   *     "user": { ... }
   *   }
   * }
   */
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard) // Enforce JWT authentication
  async refresh(@Req() req: Request) {
    // Extract userId from JWT payload (injected by JwtAuthGuard)
    const response = await this.authService.refresh((req.user as any)?.userId);
    return {
      success: true,
      data: response,
    };
  }

  /**
   * POST /auth/logout
   * 
   * Logout user (client-side operation)
   * 
   * Since this is stateless JWT authentication, logout is primarily
   * for client cleanup (clear token from localStorage).
   * Server side: Token remains valid until expiration.
   * 
   * In production, could implement token blacklist if needed.
   * 
   * @async
   * @param {Request} req - Express request (JWT extracted but not used)
   * @returns {Object} { success: true, data: { message } }
   * @status 200 - Logout successful
   * @status 401 - Not authenticated
   * 
   * @guard JwtAuthGuard - Verify user is authenticated
   * 
   * @example
   * POST /api/v1/auth/logout
   * Authorization: Bearer eyJhbG...
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "message": "Logged out successfully"
   *   }
   * }
   */
  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard) // Enforce JWT authentication
  async logout() {
    return {
      success: true,
      data: { message: 'Logged out successfully' },
    };
  }
}
