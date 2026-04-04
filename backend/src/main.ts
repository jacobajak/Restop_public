import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cors from 'cors';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Bootstrap the NestJS application
 * 
 * This function initializes the RESTOP backend server with:
 * - Security middleware (Helmet for HTTP headers, CORS for cross-origin requests)
 * - Global validation pipe (DTO validation with whitelist enforcement)
 * - API prefix configuration (defaults to 'api/v1')
 * - Environment-based configuration loading
 * 
 * @async
 * @returns {Promise<void>}
 */
async function bootstrap() {
  // Create the NestJS application instance with AppModule configuration
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  /**
   * Security Middleware
   * - Helmet: Secures Express app by setting various HTTP headers
   * - CORS: Allows requests from frontend URLs
   */
  app.use(helmet());
  
  // Get allowed origins from environment
  const frontendUrl = configService.get('FRONTEND_URL', 'http://localhost:3000');
  // Allow flexibility for development (different ports)
  const allowedOrigins = process.env.NODE_ENV === 'development' 
    ? /^http:\/\/localhost:\d+$/  // Allow any localhost port in development
    : frontendUrl;  // Use exact URL in production
  
  app.use(
    cors({
      origin: allowedOrigins,
      // Include credentials (cookies, authorization headers) in CORS requests
      credentials: true,
    })
  );

  /**
   * Global Validation Pipe
   * Validates all incoming DTOs against their defined schemas:
   * - whitelist: Strips properties that aren't decorated with @Expose()
   * - forbidNonWhitelisted: Throws error on non-whitelisted properties
   * - transform: Automatically transforms payloads to DTO instances
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Register global exception filter for debugging
  app.useGlobalFilters(new AllExceptionsFilter());

  // Set global API prefix for all routes (e.g., '/api/v1')
  app.setGlobalPrefix(configService.get('API_PREFIX', 'api/v1'));

  // Start listening on configured port
  const port = configService.get('PORT', 3001);
  await app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });
}

// Start the application
bootstrap();
