/**
 * Test Data Seeding for Automated Test Suite
 * Creates consistent test users and data for running the test pipeline
 */

export interface TestUser {
  id?: string;
  email: string;
  password: string;
  name: string;
  tenant?: {
    id?: string;
    name: string;
    slug: string;
  };
}

export interface TestData {
  userA: TestUser;
  userB: TestUser;
  testItems: any[];
}

/**
 * Generate consistent test data for the test suite
 */
export const generateTestData = (): TestData => {
  return {
    userA: {
      email: 'testa@test.com',
      password: 'TestPass@123',
      name: 'Test User A',
      tenant: {
        name: 'Restaurant A',
        slug: 'restaurant-a',
      },
    },
    userB: {
      email: 'testb@test.com',
      password: 'TestPass@456',
      name: 'Test User B',
      tenant: {
        name: 'Restaurant B',
        slug: 'restaurant-b',
      },
    },
    testItems: [
      {
        name: 'Test Burger',
        description: 'Delicious test burger',
        price: 50,
        category: 'Main Course',
      },
      {
        name: 'Test Pizza',
        description: 'Tasty test pizza',
        price: 75,
        category: 'Main Course',
      },
      {
        name: 'Test Soda',
        description: 'Refreshing test drink',
        price: 20,
        category: 'Beverages',
      },
    ],
  };
};

/**
 * Test credentials for validation tests
 */
export const invalidTestData = {
  invalidEmails: ['test@', 'test', 'test@.com', '@test.com', 'test@@test.com'],
  weakPasswords: ['123', 'abc', 'short', '12345'],
  validEmail: 'valid@test.com',
  strongPassword: 'StrongPass@123456',
};

/**
 * Seed helper functions
 */
export const testSeeds = {
  /**
   * Generate a unique order ID for testing
   */
  generateOrderId: () => {
    return `test-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Generate a unique email for testing
   */
  generateEmail: () => {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`;
  },

  /**
   * Generate a test order payload
   */
  generateOrderPayload: (items: any[] = []) => {
    return {
      items: items.length
        ? items
        : [
            { menuItemId: 'item-1', quantity: 2 },
            { menuItemId: 'item-2', quantity: 1 },
          ],
      total: 100,
      paymentMethod: 'cash',
      notes: 'Test order - automated test suite',
    };
  },

  /**
   * Generate a test user registration payload
   */
  generateRegistrationPayload: (overrides = {}) => {
    return {
      email: testSeeds.generateEmail(),
      password: 'Test@Pass123456',
      name: 'Test User',
      ...overrides,
    };
  },

  /**
   * Generate a test menu item
   */
  generateMenuItemPayload: (overrides = {}) => {
    return {
      name: `Test Item ${Date.now()}`,
      description: 'Test menu item',
      price: 50,
      category: 'Main',
      available: true,
      ...overrides,
    };
  },

  /**
   * Generate test tenant data
   */
  generateTenantPayload: (overrides = {}) => {
    const id = Date.now();
    return {
      name: `Test Restaurant ${id}`,
      slug: `test-restaurant-${id}`,
      email: `test-tenant-${id}@test.com`,
      phone: '1234567890',
      address: 'Test Address',
      city: 'Test City',
      ...overrides,
    };
  },
};

/**
 * Expected test responses for validation
 */
export const expectedResponses = {
  success_201: (field: string) => ({
    statusCode: 201,
    hasProperty: field,
  }),
  success_200: {
    statusCode: 200,
  },
  error_401: {
    statusCode: 401,
    message: 'Unauthorized',
  },
  error_404: {
    statusCode: 404,
    message: 'Not Found',
  },
  error_403: {
    statusCode: 403,
    message: 'Forbidden',
  },
  error_429: {
    statusCode: 429,
    message: 'Too Many Requests',
  },
  error_400: {
    statusCode: 400,
    message: 'Bad Request',
  },
};

/**
 * Test endpoints
 */
export const testEndpoints = {
  // Auth
  auth: {
    register: '/v1/auth/register',
    login: '/v1/auth/login',
    refresh: '/v1/auth/refresh',
    logout: '/v1/auth/logout',
  },
  // Menu
  menu: {
    getPublic: (slug: string) => `/v1/menu/${slug}`,
    categories: (tenantId: string) => `/v1/menu/categories/${tenantId}`,
    items: '/v1/menu/items',
  },
  // Orders
  orders: {
    create: '/v1/orders',
    getById: (id: string) => `/v1/orders/${id}`,
    list: '/v1/orders',
    updateStatus: (id: string) => `/v1/orders/${id}/status`,
    listByTenant: (tenantId: string) => `/v1/orders/tenant/${tenantId}`,
  },
  // Tenants
  tenants: {
    create: '/v1/tenants',
    getById: (id: string) => `/v1/tenants/${id}`,
    list: '/v1/tenants',
    update: (id: string) => `/v1/tenants/${id}`,
  },
  // System
  health: '/health',
  invalid: '/invalid-endpoint-12345',
};

/**
 * Test timeouts (in milliseconds)
 */
export const testTimeouts = {
  DEFAULT: 5000,
  WEBSOCKET: 10000,
  DATABASE: 15000,
  ANIMATION: 1000,
};
