import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Global exception filter to catch and log all exceptions
 * This helps debug issues with exception handling
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let exceptionType = 'Unknown';

    // Log detailed exception info
    this.logger.error(`[EXCEPTION DEBUG] Exception caught:`, {
      type: typeof exception,
      constructor: exception?.constructor?.name || 'unknown',
      isHttpException: exception instanceof HttpException,
      exception: exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
      full: JSON.stringify(exception, null, 2),
    });

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as Record<string, any>).message || 'Error';
      exceptionType = 'HttpException';
    } else if (exception instanceof Error) {
      message = exception.message;
      exceptionType = 'Error';
      this.logger.error(`[EXCEPTION DEBUG] Error message: ${exception.message}`);
      this.logger.error(`[EXCEPTION DEBUG] Error stack:`, exception.stack);
    }

    this.logger.error(`[EXCEPTION DEBUG] Final response: status=${status}, message=${message}, type=${exceptionType}`);

    response.status(status).json({
      statusCode: status,
      message,
      exceptionType,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
