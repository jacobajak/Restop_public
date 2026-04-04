import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { OtpChallenge, LoginAttempt } from './entities/otp-challenge.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpService } from './services/otp.service';
import { EmailService } from './services/email.service';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, OtpChallenge, LoginAttempt]),
    PassportModule,
    TenantsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, EmailService, JwtStrategy],
  exports: [AuthService, OtpService, EmailService],
})
export class AuthModule {}
