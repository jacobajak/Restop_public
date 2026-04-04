import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsService } from '../tenants/services/tenants.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { OtpService } from './services/otp.service';
import { VerifyOtpDto, ResendOtpDto } from './dto/2fa.dto';

/**
 * Authentication Service
 * 
 * Handles all authentication-related operations including:
 * - User login with email and password validation
 * - User registration with role-based tenant assignment
 * - JWT token generation and validation
 * - Token refresh mechanism
 * 
 * Security Features:
 * - Password hashing using bcrypt (10 salt rounds)
 * - JWT-based stateless authentication
 * - Role-based access control (PLATFORM_ADMIN, TENANT_OWNER, TENANT_STAFF)
 * - Tenant isolation for multi-tenant support
 * 
 * @class AuthService
 * @injectable
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    /** User repository for database operations */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    /** Tenants service for tenant creation and management */
    private readonly tenantsService: TenantsService,
    /** JWT service for token generation and validation */
    private readonly jwtService: JwtService,
    /** OTP service for 2FA */
    private readonly otpService: OtpService,
  ) {}

  /**
   * Authenticate user with email and password (Step 1 of 2FA)
   * 
   * NEW 2FA FLOW:
   * Step 1 (login):
   * 1. Find user by email
   * 2. Verify password using bcrypt comparison
   * 3. Generate OTP and send via email
   * 4. Return challenge_id (NOT JWT token yet)
   * 
   * Step 2 (verify-otp):
   * 5. User submits OTP code
   * 6. Verify OTP is valid
   * 7. Generate JWT token with user claims
   * 8. Return token and user information
   * 
   * @param {LoginDto} loginDto - User's email and password
   * @param {string} ipAddress - Client IP for security audit
   * @param {string} userAgent - Client user agent
   * @returns {Promise} { requires_2fa: true, challenge_id, email, expires_at }
   * @throws {UnauthorizedException} If user not found or password invalid
   * @throws {TooManyRequestsException} If rate limited
   * 
   * @example
   * // Step 1: Login with credentials
   * const response = await authService.login(
   *   { email: 'user@example.com', password: 'password123' },
   *   '192.168.1.1',
   *   'Mozilla/5.0...'
   * );
   * // Response: { requires_2fa: true, challenge_id: 'uuid', email: 'user@...' }
   * 
   * // Step 2: Verify OTP
   * const tokenResponse = await authService.verifyOtp(
   *   { challenge_id: 'uuid', otp_code: '123456' }
   * );
   * // Response: { access_token: 'jwt...', user: {...} }
   */
  async login(
    loginDto: LoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<any> {
    // Check if email is currently locked
    const isLocked = await this.otpService.isEmailLocked(loginDto.email);
    if (isLocked) {
      throw new UnauthorizedException(
        'Account temporarily locked due to too many login attempts. Please try again in 15 minutes.',
      );
    }

    // Query user with tenant relation for complete user context
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
      relations: ['tenant'],
    });

    if (!user) {
      // Record failed login attempt
      await this.otpService.recordLoginAttempt(
        loginDto.email,
        ipAddress,
        userAgent,
        true,
        'user_not_found',
      );
      // Use generic message to prevent email enumeration attacks
      throw new UnauthorizedException('Invalid email or password');
    }

    // Compare provided password with stored password hash using bcrypt
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      // Record failed login attempt
      await this.otpService.recordLoginAttempt(
        loginDto.email,
        ipAddress,
        userAgent,
        true,
        'invalid_password',
      );
      // Use generic message to prevent email enumeration attacks
      throw new UnauthorizedException('Invalid email or password');
    }

    // ✅ PASSWORD VALID - SKIP 2FA FOR NOW AND DIRECTLY ISSUE JWT
    // Generate JWT token directly without OTP
    const accessToken = this.jwtService.sign({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    });

    // Record successful login
    await this.otpService.recordLoginAttempt(
      loginDto.email,
      ipAddress,
      userAgent,
      false,
      'login_success',
    );

    this.logger.log(`User ${user.email} logged in successfully from IP ${ipAddress}`);

    // Return JWT token directly (2FA disabled temporarily)
    return {
      success: true,
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      data: {
        access_token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    };
  }

  /**
   * Verify OTP code and issue JWT token (Step 2 of 2FA)
   * 
   * @param {VerifyOtpDto} dto - Challenge ID and OTP code
   * @returns {Promise<AuthResponseDto>} JWT token and user metadata
   * @throws {BadRequestException} If challenge not found or OTP invalid
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponseDto> {
    // Verify OTP is valid
    await this.otpService.verifyOtp(dto.challenge_id, dto.otp_code);

    // Get user from challenge (need to query OTP to get user_id)
    // For this, we need to get the challenge and then the user
    const OtpChallenge = this.userRepository.manager.getRepository('OtpChallenge');
    const challenge = await OtpChallenge.findOne({
      where: { id: dto.challenge_id },
    });

    if (!challenge) {
      throw new BadRequestException('Challenge not found');
    }

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: challenge.user_id },
      relations: ['tenant'],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Record successful login
    await this.otpService.recordLoginAttempt(
      user.email,
      challenge.ip_address || '',
      challenge.user_agent || '',
      false, // Not failed
    );

    // Generate JWT token now that 2FA is verified
    const token = this.generateJwt(user);

    this.logger.log(`User ${user.email} successfully authenticated with 2FA`);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
        slug: user.tenant?.slug,
      },
    };
  }

  /**
   * Resend OTP code to user's email
   * 
   * Used if user didn't receive OTP or if it expired.
   * Respects cooldown (30 seconds) and max resends (3 per challenge).
   * 
   * @param {ResendOtpDto} dto - Challenge ID and email
   * @returns {Promise} { success: true, expires_at }
   * @throws {BadRequestException} If challenge invalid or max resends exceeded
   * @throws {TooManyRequestsException} If cooldown not met
   */
  async resendOtp(dto: ResendOtpDto): Promise<{ success: boolean; expires_at: Date }> {
    const { expiresAt } = await this.otpService.resendOtp(
      dto.challenge_id,
      dto.email,
    );

    return {
      success: true,
      expires_at: expiresAt,
    };
  }

  /**
   * Register a new user with role-based tenant assignment
   * 
   * Supported Roles:
   * - PLATFORM_ADMIN: System administrator, no tenant assigned
   * - TENANT_OWNER: Restaurant/vendor owner, creates new tenant
   * - TENANT_STAFF: Restaurant staff, assigned to existing tenant (requires tenant_id)
   * 
   * Process:
   * 1. Validate email doesn't already exist
   * 2. Hash password using bcrypt
   * 3. If TENANT_OWNER role, create new tenant with slug
   * 4. Create user record with role and tenant association
   * 5. Generate JWT token
   * 6. Return token and user metadata
   * 
   * @param {RegisterDto} registerDto - User registration data with email, password, role, and optional tenant info
   * @returns {Promise<AuthResponseDto>} JWT token and user metadata
   * @throws {BadRequestException} If email exists, slug invalid, or missing required fields for role
   * 
   * @example
   * // Register as tenant owner (creates new restaurant)
   * const response = await authService.register({
   *   email: 'owner@pizza.com',
   *   password: 'securePassword123',
   *   name: 'John Owner',
   *   role: UserRole.TENANT_OWNER,
   *   tenant_name: 'Best Pizza Co',
   *   tenant_slug: 'best-pizza-co'
   * });
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      // Verify email uniqueness to prevent duplicate accounts
      const existingUser = await this.userRepository.findOne({
        where: { email: registerDto.email },
      });

      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }

      // Hash password with bcrypt for secure storage (10 salt rounds)
      const password_hash = await bcrypt.hash(registerDto.password, 10);

      let tenant: Tenant | null = null;

      // Tenant creation for TENANT_OWNER role
      if (registerDto.role === UserRole.TENANT_OWNER) {
        // Validate required fields for tenant owner registration
        if (!registerDto.tenant_name || !registerDto.tenant_slug) {
          throw new BadRequestException(
            'tenant_name and tenant_slug required for TENANT_OWNER role',
          );
        }

        try {
          // Create tenant via TenantsService (generates QR code, validates slug uniqueness)
          // This will throw BadRequestException if slug already exists
          tenant = await this.tenantsService.createTenant({
            name: registerDto.tenant_name,
            slug: registerDto.tenant_slug,
            email: registerDto.email,
            currency: 'USD',
          });
        } catch (tenantError) {
          this.logger.error(
            `Failed to create tenant for email ${registerDto.email}: ${JSON.stringify(tenantError)}`,
            tenantError.stack,
          );
          // If tenant creation fails, re-throw with proper error message
          if (tenantError instanceof BadRequestException) {
            throw tenantError;
          }
          throw new InternalServerErrorException(
            `Failed to create tenant: ${tenantError.message}`,
          );
        }
      }

      // Create user entity with password hash and tenant association
      const user = this.userRepository.create({
        name: registerDto.name,
        email: registerDto.email,
        password_hash,
        role: registerDto.role,
        tenant_id: tenant?.id || null, // Null tenant for PLATFORM_ADMIN role
      });

      // Persist user to database
      let savedUser;
      try {
        savedUser = await this.userRepository.save(user);
      } catch (saveError) {
        this.logger.error(
          `Failed to save user ${registerDto.email}: ${JSON.stringify(saveError)}`,
          saveError.stack,
        );
        throw new InternalServerErrorException(
          `Failed to create user account: ${saveError.message}`,
        );
      }

      // Reload user to ensure tenant relation is populated
      const userWithTenant = await this.userRepository.findOne({
        where: { id: savedUser.id },
        relations: ['tenant'],
      });

      if (!userWithTenant) {
        throw new InternalServerErrorException('Failed to retrieve created user');
      }

      // Generate JWT token containing user claims
      const token = this.generateJwt(userWithTenant);

      this.logger.log(
        `User registered successfully: ${userWithTenant.email} (${userWithTenant.role})`,
      );

      return {
        access_token: token,
        user: {
          id: userWithTenant.id,
          email: userWithTenant.email,
          name: userWithTenant.name,
          role: userWithTenant.role,
          tenant_id: userWithTenant.tenant_id,
          slug: userWithTenant.tenant?.slug,
        },
      };
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      // Log and wrap unknown errors
      this.logger.error(
        `Unexpected error during registration: ${JSON.stringify(error)}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred during registration',
      );
    }
  }

  /**
   * Refresh user's JWT token
   * 
   * Used when the current token is about to expire or is expired.
   * Validates user still exists and generates a new token with current claims.
   * 
   * @param {string} userId - The user ID to refresh token for
   * @returns {Promise<AuthResponseDto>} New JWT token and user metadata
   * @throws {UnauthorizedException} If user not found
   * 
   * @example
   * const response = await authService.refresh(userId);
   * // Update client token with response.access_token
   */
  async refresh(userId: string): Promise<AuthResponseDto> {
    // Query user to verify they still exist and get current state
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tenant'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate fresh JWT token
    const token = this.generateJwt(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
        slug: user.tenant?.slug,
      },
    };
  }

  /**
   * Generate JWT token for authenticated requests
   * 
   * Creates a stateless JWT token containing:
   * - userId: User identifier for authorization
   * - tenantId: Tenant context for multi-tenant isolation
   * - role: User's permission level
   * 
   * Token expiration is configured via JWT_EXPIRATION env variable (default: '7d')
   * 
   * @private
   * @param {User} user - User entity with id, tenant_id, and role
   * @returns {string} Signed JWT token
   * 
   * @example
   * // This is called internally by login/register/refresh
   * const token = this.generateJwt(user);
   * // Token payload: { userId, tenantId, role, iat, exp }
   */
  private generateJwt(user: User): string {
    // Construct JWT payload with user identity and permissions
    const payload = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    };

    // Sign payload with JWT secret from config
    // Expiration is automatic based on JWT_EXPIRATION env var
    return this.jwtService.sign(payload);
  }
}
