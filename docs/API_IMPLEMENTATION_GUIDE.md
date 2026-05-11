# RESTOP API Implementation Guide

**Purpose:** Standardized patterns for adding new API endpoints to the RESTOP platform  
**Version:** 1.0  
**Last Updated:** January 15, 2024

---

## Table of Contents

1. [Overview](#overview)
2. [Endpoint Structure](#endpoint-structure)
3. [Authentication & Authorization](#authentication--authorization)
4. [Request/Response Patterns](#requestresponse-patterns)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Documentation](#documentation)
8. [Testing](#testing)
9. [Examples](#examples)

---

## Overview

### Architecture Layers

RESTOP APIs follow a 3-layer architecture:

```
┌─────────────────────────────────────────────────────┐
│         Controller Layer (HTTP/REST)                │
│  - Request validation                               │
│  - Route handling                                   │
│  - Response formatting                              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│         Service Layer (Business Logic)              │
│  - Data validation                                  │
│  - Business rules                                   │
│  - Database operations                              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│         Repository/ORM Layer (Data Access)          │
│  - Database queries                                 │
│  - Transactions                                     │
│  - Caching                                          │
└─────────────────────────────────────────────────────┘
```

### Principles

- **REST Compliance** – Use standard HTTP methods (GET, POST, PATCH, DELETE)
- **Consistency** – Follow existing patterns in codebase
- **Security** – Enforce authentication & authorization
- **Validation** – Validate all inputs
- **Error Handling** – Use standard error responses
- **Documentation** – Document all endpoints comprehensively

---

## Endpoint Structure

### Naming Conventions

**REST Resources (Nouns, not verbs):**
```
✅ Good:
GET    /api/v1/orders
POST   /api/v1/orders
GET    /api/v1/orders/:id
PATCH  /api/v1/orders/:id/status

❌ Bad:
GET    /api/v1/getOrders
POST   /api/v1/createOrder
GET    /api/v1/orderDetails
PATCH  /api/v1/updateOrderStatus
```

**Nested Resources:**
```
✅ Good:
GET  /api/v1/orders/:orderId/payments
GET  /api/v1/tenants/:tenantId/payment-accounts
POST /api/v1/orders/:orderId/confirm

❌ Bad:
GET  /api/v1/orders/payments
GET  /api/v1/paymentAccounts
```

**Special Actions (use sub-resources for non-CRUD operations):**
```
✅ Good:
POST  /admin/settlements/:id/retry
PATCH /tenants/:id/payment-accounts/:accountId/default
POST  /orders/:id/confirm

❌ Bad:
POST  /admin/settlements/retry/:id
POST  /tenants/setDefaultPaymentAccount
```

### HTTP Methods

| Method | Purpose | Idempotent | Cacheable |
|--------|---------|-----------|-----------|
| GET | Retrieve resource(s) | Yes | Yes |
| POST | Create new resource | No | No |
| PATCH | Partial update | No | No |
| PUT | Full replacement | Yes | No |
| DELETE | Remove resource | Yes | No |

**When to Use:**
- `GET` – Retrieve data, no side effects
- `POST` – Create new resource, trigger action
- `PATCH` – Partial updates (recommended for most updates)
- `PUT` – Replace entire resource (rare in REST APIs)
- `DELETE` – Remove resource (use sparingly, prefer soft deletes)

### Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | GET, PATCH successful |
| 201 | Created | POST resource successfully created |
| 204 | No Content | DELETE successful, no response body |
| 400 | Bad Request | Invalid input validation |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Authenticated but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Business logic violation (duplicate, state conflict) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

---

## Authentication & Authorization

### Controller Setup

```typescript
import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('api/v1/orders')
export class OrdersController {
  constructor(private orderService: OrderService) {}

  // Public endpoint (no guards)
  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  // Tenant-protected endpoint
  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async listTenantOrders(@Req() req: any) {
    return this.orderService.listByTenant(req.user.tenant_id);
  }

  // Admin-protected endpoint
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAllOrders() {
    return this.orderService.listAll();
  }
}
```

### Guard Types

1. **JwtAuthGuard** – Validates JWT token signature and expiration
2. **TenantGuard** – Verifies user has TENANT role
3. **AdminGuard** – Verifies user has PLATFORM_ADMIN role
4. **RoleGuard** – Custom role-based access control

### User Context

Extract authenticated user from request:

```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
async getCurrentUser(@Req() req: any) {
  const user = req.user;  // JWT payload
  return {
    id: user.sub,
    email: user.email,
    role: user.role,
    tenant_id: user.tenant_id
  };
}
```

---

## Request/Response Patterns

### Request DTOs

Use Data Transfer Objects for validation:

```typescript
import { IsString, IsNumber, IsOptional, IsEmail, Min, Max } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  tenant_id: string;

  @IsArray()
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsEnum(['CASH', 'MOBILE_MONEY', 'CARD'])
  payment_method?: string;
}

export class OrderItemDto {
  @IsString()
  menu_item_id: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  quantity: number;

  @IsOptional()
  @IsString()
  special_instructions?: string;
}
```

### Response Format

**Success Response:**
```typescript
@Get(':id')
async getOrder(@Param('id') id: string) {
  const order = await this.orderService.findById(id);
  return {
    data: order,
    statusCode: 200,
    timestamp: new Date().toISOString()
  };
}
```

**List Response with Pagination:**
```typescript
@Get()
async listOrders(
  @Query('page', ParseIntPipe) page: number = 1,
  @Query('limit', ParseIntPipe) limit: number = 20
) {
  const [data, total] = await this.orderService.paginate(page, limit);
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}
```

---

## Error Handling

### Exception Filters

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      statusCode: status,
      message: exceptionResponse['message'],
      error: exceptionResponse['error'],
      timestamp: new Date().toISOString()
    });
  }
}
```

### Throwing Errors

```typescript
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';

export class OrderService {
  async findById(id: string) {
    const order = await this.db.orders.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  async updateStatus(id: string, status: string) {
    const order = await this.findById(id);
    
    if (!this.isValidStatusTransition(order.status, status)) {
      throw new HttpException(
        `Cannot transition from ${order.status} to ${status}`,
        HttpStatus.CONFLICT
      );
    }

    return await this.db.orders.update(id, { status });
  }
}
```

---

## Rate Limiting

### Implementation

```typescript
import { RateLimit } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';

@Controller('api/v1/payments')
@UseGuards(ThrottlerGuard)
export class PaymentsController {
  @Post('initiate-mobile-money')
  @Throttle(30, 3600)  // 30 requests per hour
  async initiateMobileMoneyPayment(@Body() dto: InitiatePaymentDto) {
    return this.paymentService.initiatePayment(dto);
  }

  @Get()
  @Throttle(100, 60)  // 100 requests per minute
  async listPayments() {
    return this.paymentService.list();
  }
}
```

### Custom Rate Limiting

```typescript
export class CustomRateLimitGuard implements CanActivate {
  constructor(private redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user.id;
    const key = `rate-limit:${userId}:${request.path}`;

    const count = await this.redisService.incr(key);
    await this.redisService.expire(key, 60);  // 1 minute window

    if (count > RATE_LIMIT) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }
}
```

---

## Documentation

### Endpoint Documentation Template

```markdown
### POST /api/v1/orders

**Purpose:** Create a new order

**Authentication:** None (public endpoint)

**Rate Limit:** 100 requests per minute per IP

**Request Body:**
- `tenant_id` (string, required) – Restaurant ID
- `items` (array, required) – Order items
  - `menu_item_id` (string) – Menu item UUID
  - `quantity` (number) – Quantity (1-100)
  - `special_instructions` (string, optional)
- `payment_method` (string, optional) – CASH, MOBILE_MONEY, CARD

**Response (201 Created):**
```json
{
  "id": "ord_123",
  "tenant_id": "rest_456",
  "status": "CREATED",
  "total": 22.13,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` – Invalid tenant_id or items
- `404 Not Found` – Tenant or menu items not found
- `409 Conflict` – Tenant is inactive

**Examples:**

Request:
```bash
curl -X POST https://api.restop.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "rest_789",
    "items": [{
      "menu_item_id": "item_101",
      "quantity": 2
    }]
  }'
```

Response:
```json
{
  "data": {
    "id": "ord_123",
    "tenant_id": "rest_789",
    "status": "CREATED",
    "total": 22.13
  }
}
```
```

---

## Testing

### Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrderService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            list: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrderService>(OrderService);
  });

  describe('create', () => {
    it('should create an order', async () => {
      const dto = {
        tenant_id: 'rest_123',
        items: [{ menu_item_id: 'item_456', quantity: 2 }]
      };

      const result = {
        id: 'ord_789',
        ...dto,
        status: 'CREATED'
      };

      jest.spyOn(service, 'create').mockResolvedValue(result);

      expect(await controller.createOrder(dto)).toEqual(result);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should throw error for invalid tenant', async () => {
      const dto = {
        tenant_id: 'invalid',
        items: []
      };

      jest.spyOn(service, 'create').mockRejectedValue(
        new NotFoundException('Tenant not found')
      );

      await expect(controller.createOrder(dto)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
```

### Integration Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './app.module';

describe('Orders API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/orders', () => {
    it('should create order', () => {
      return request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({
          tenant_id: 'rest_123',
          items: [{ menu_item_id: 'item_456', quantity: 2 }]
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data.status).toBe('CREATED');
        });
    });

    it('should return 404 for invalid tenant', () => {
      return request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({
          tenant_id: 'invalid',
          items: []
        })
        .expect(404);
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('should get order details', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/ord_123')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('id', 'ord_123');
        });
    });
  });
});
```

---

## Examples

### Example 1: Simple GET Endpoint

```typescript
@Controller('api/v1/restaurants/:id/info')
export class RestaurantController {
  constructor(private restaurantService: RestaurantService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getRestaurantInfo(@Param('id') id: string) {
    try {
      const restaurant = await this.restaurantService.getPublicInfo(id);
      return {
        data: restaurant,
        statusCode: 200
      };
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
```

### Example 2: POST with Validation

```typescript
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private orderService: OrderService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    try {
      // Validate tenant exists
      const tenant = await this.tenantService.findById(dto.tenant_id);
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      // Validate items exist
      for (const item of dto.items) {
        const menuItem = await this.menuService.findItem(item.menu_item_id);
        if (!menuItem) {
          throw new NotFoundException(`Menu item ${item.menu_item_id} not found`);
        }
      }

      // Create order
      const order = await this.orderService.create(dto);

      return {
        data: order,
        statusCode: 201
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        error.message,
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
```

### Example 3: PATCH with Authorization

```typescript
@Controller('api/v1/orders/:id')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrdersController {
  @Patch('status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: any
  ) {
    try {
      // Get order
      const order = await this.orderService.findById(id);
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Verify ownership
      if (order.tenant_id !== req.user.tenant_id) {
        throw new HttpException(
          'Unauthorized',
          HttpStatus.FORBIDDEN
        );
      }

      // Validate transition
      if (!this.isValidTransition(order.status, dto.status)) {
        throw new HttpException(
          `Cannot transition from ${order.status} to ${dto.status}`,
          HttpStatus.CONFLICT
        );
      }

      // Update and return
      const updated = await this.orderService.updateStatus(id, dto.status);
      return {
        data: updated,
        statusCode: 200
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private isValidTransition(from: string, to: string): boolean {
    const transitions = {
      CREATED: ['PENDING_PAYMENT', 'REJECTED'],
      PENDING_PAYMENT: ['CONFIRMED', 'REJECTED'],
      CONFIRMED: ['PREPARING', 'REJECTED'],
      PREPARING: ['READY'],
      READY: ['COMPLETED'],
      COMPLETED: [],
      REJECTED: []
    };
    return transitions[from]?.includes(to) || false;
  }
}
```

---

## Checklist for New Endpoints

- [ ] **Design**
  - [ ] Endpoint name follows REST naming conventions
  - [ ] HTTP method is appropriate
  - [ ] Request/response format defined

- [ ] **Implementation**
  - [ ] Controller method created with proper decorators
  - [ ] DTO with validation rules created
  - [ ] Service layer implements business logic
  - [ ] All error cases handled

- [ ] **Security**
  - [ ] Authentication guards applied if needed
  - [ ] Authorization checks implemented
  - [ ] Input validation complete
  - [ ] Rate limiting configured

- [ ] **Documentation**
  - [ ] Endpoint documented in markdown with purpose, params, examples
  - [ ] API documentation file updated
  - [ ] Quick start example added if applicable

- [ ] **Testing**
  - [ ] Unit tests written (80%+ coverage)
  - [ ] Integration tests written
  - [ ] Error cases tested
  - [ ] Manual testing completed

- [ ] **Performance**
  - [ ] Database queries optimized
  - [ ] Caching applied where appropriate
  - [ ] Rate limits configured
  - [ ] Load tested

---

**Version:** 1.0  
**Maintained by:** RESTOP API Team  
**Last Updated:** January 15, 2024
