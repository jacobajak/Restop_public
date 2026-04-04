import { test, expect } from '@playwright/test';

test.describe('Complete Order Flow: Customer to Dashboard', () => {
  // Complete E2E flow: Scan QR → Add items → Confirm cash order → Dashboard accept → Status updates → Customer sees live updates
  
  test('Customer scans QR, adds items, places cash order, and receives live status updates', async ({ browser, context }) => {
    // Create two pages: one for customer, one for dashboard/admin
    const customerPage = await context.newPage();
    const dashboardPage = await context.newPage();

    try {
      // ========== CUSTOMER FLOW ==========
      console.log('📱 CUSTOMER: Starting order journey...');
      
      // Step 1: Simulate QR scan - navigate to menu page
      await customerPage.goto('/menu/test-restaurant');
      await expect(customerPage).toHaveTitle(/menu|menu page/i);
      
      // Step 2: Verify menu is loaded
      const menuItems = await customerPage.locator('[data-testid="menu-item"]').all();
      console.log(`📋 Found ${menuItems.length} menu items`);
      expect(menuItems.length).toBeGreaterThan(0);
      
      // Step 3: Add items to cart
      // Add first item
      const firstItem = customerPage.locator('[data-testid="menu-item"]').first();
      await firstItem.locator('button:has-text("Add")').click();
      await customerPage.fill('input[type="number"]', '2');
      await customerPage.locator('button:has-text("Confirm")').click();
      
      console.log('➕ Added first item (quantity: 2)');
      
      // Add second item
      const secondItem = customerPage.locator('[data-testid="menu-item"]').nth(1);
      await secondItem.locator('button:has-text("Add")').click();
      await customerPage.fill('input[type="number"]', '1');
      await customerPage.locator('button:has-text("Confirm")').click();
      
      console.log('➕ Added second item (quantity: 1)');
      
      // Step 4: View cart
      const cartButton = customerPage.locator('[data-testid="cart-button"]');
      await expect(cartButton).toBeVisible();
      const cartItemCount = await cartButton.textContent();
      expect(cartItemCount).toContain('3'); // 2 + 1 items
      
      console.log('🛒 Cart updated: 3 items total');
      
      // Step 5: Open payment modal
      await customerPage.locator('[data-testid="checkout-button"]').click();
      
      // Step 6: Select CASH payment
      const cashOption = customerPage.locator('label:has-text("Cash")');
      await cashOption.click();
      
      console.log('💵 Payment method selected: CASH');
      
      // Step 7: Confirm order
      const confirmOrderButton = customerPage.locator('button:has-text("Place Order")');
      await expect(confirmOrderButton).toBeEnabled();
      
      // Wait and click (catches modal animations)
      await customerPage.waitForTimeout(500);
      await confirmOrderButton.click();
      
      // Step 8: Get order number from success message
      const successMessage = customerPage.locator('[data-testid="order-success"]');
      await expect(successMessage).toBeVisible({ timeout: 10000 });
      
      const orderText = await successMessage.textContent();
      const orderNumber = orderText?.match(/ORD-\d+/)?.[0] || 'ORD-TEST-001';
      
      console.log(`✅ Order placed successfully: ${orderNumber}`);
      
      // Step 9: Navigate to order status page
      await customerPage.goto(`/order-status/${orderNumber}`);
      
      // Step 10: Verify initial order status (CREATED)
      const statusBadge = customerPage.locator('[data-testid="order-status"]');
      await expect(statusBadge).toContainText('CREATED|Order Created');
      
      console.log('📦 Order status: CREATED');
      
      // Keep customer page open and listening for updates
      
      // ========== DASHBOARD FLOW ==========
      console.log('\n🖥️  ADMIN/DASHBOARD: Starting order management...');
      
      // Step 1: Login to dashboard
      await dashboardPage.goto('/auth/login');
      
      // Fill credentials
      await dashboardPage.fill('input[type="email"]', 'admin@test.com');
      await dashboardPage.fill('input[type="password"]', 'Admin@123456');
      
      // Click login
      await dashboardPage.locator('button:has-text("Login")').click();
      
      // Wait for redirect to dashboard
      await dashboardPage.waitForURL('/dashboard/**', { timeout: 10000 });
      console.log('✅ Admin logged in successfully');
      
      // Step 2: Navigate to orders section
      await dashboardPage.goto('/dashboard/orders');
      await expect(dashboardPage).toHaveTitle(/orders|dashboard/i);
      
      // Step 3: Find the order we just placed
      const orderRow = dashboardPage.locator(`text=${orderNumber}`);
      await expect(orderRow).toBeVisible({ timeout: 10000 });
      
      console.log(`📍 Found order ${orderNumber} in dashboard`);
      
      // Step 4: Accept/Confirm the order
      const acceptButton = orderRow.locator('button', { hasText: /accept|confirm/i });
      await acceptButton.click();
      
      console.log('✅ Order CONFIRMED by admin');
      
      // Add small delay to allow WebSocket updates
      await customerPage.waitForTimeout(1000);
      
      // Step 5: Update order status to PREPARING
      const statusDropdown = dashboardPage.locator('[data-testid="order-status-select"]');
      await statusDropdown.selectOption('PREPARING');
      
      console.log('👨‍🍳 Order status updated to: PREPARING');
      await customerPage.waitForTimeout(1000);
      
      // Step 6: Check customer sees PREPARING status
      const customerStatusNow = await customerPage.locator('[data-testid="order-status"]').textContent();
      expect(customerStatusNow).toContain('PREPARING');
      console.log('📱 CUSTOMER sees: Order is PREPARING');
      
      // Step 7: Update to READY
      await statusDropdown.selectOption('READY');
      console.log('🎉 Order status updated to: READY');
      await customerPage.waitForTimeout(1000);
      
      // Step 8: Customer should see READY status
      const readyStatus = await customerPage.locator('[data-testid="order-status"]').textContent();
      expect(readyStatus).toContain('READY');
      console.log('📱 CUSTOMER sees: Order is READY');
      
      // Step 9: Verify visual indicators update on customer page
      const readyIcon = customerPage.locator('[data-testid="ready-icon"]');
      await expect(readyIcon).toBeVisible();
      
      // Step 10: Update to COMPLETED
      await statusDropdown.selectOption('COMPLETED');
      console.log('✔️ Order status updated to: COMPLETED');
      await customerPage.waitForTimeout(1000);
      
      // Step 11: Customer should see COMPLETED status
      const completedStatus = await customerPage.locator('[data-testid="order-status"]').textContent();
      expect(completedStatus).toContain('COMPLETED');
      console.log('📱 CUSTOMER sees: Order is COMPLETED');
      
      // ========== LIVE UPDATES VERIFICATION ==========
      console.log('\n⚡ VERIFYING LIVE UPDATES...');
      
      // Check WebSocket connection indicator
      const wsIndicator = customerPage.locator('[data-testid="ws-status"]');
      const wsStatus = await wsIndicator.textContent();
      expect(wsStatus).toContain('Connected|🟢');
      console.log('✅ WebSocket connection is active');
      
      // Verify timeline shows all status changes
      const statusSteps = customerPage.locator('[data-testid="status-step"]');
      const stepCount = await statusSteps.count();
      expect(stepCount).toBeGreaterThanOrEqual(4); // At least: CREATED, CONFIRMED, PREPARING, READY, COMPLETED
      console.log(`✅ Status timeline shows ${stepCount} steps`);
      
      // ========== FINAL VERIFICATION ==========
      console.log('\n✅ COMPLETE FLOW TEST PASSED');
      console.log('Summary:');
      console.log(`  - Customer placed order ${orderNumber}`);
      console.log('  - Admin confirmed and updated status multiple times');
      console.log('  - Customer received real-time status updates via WebSocket');
      console.log('  - Order completed successfully');
      
    } finally {
      // Cleanup
      await customerPage.close();
      await dashboardPage.close();
    }
  });
});

test.describe('Customer Mobile Journey', () => {
  test('Customer can place order from mobile device', async ({ browser }) => {
    const { iPhone12 } = require('@playwright/test').devices;
    const context = await browser.newContext({
      ...iPhone12,
      baseURL: 'http://localhost:3000',
    });

    const page = await context.newPage();

    try {
      // Navigate to menu on mobile
      await page.goto('/menu/test-restaurant');
      
      // Verify mobile layout
      const viewport = page.viewportSize();
      console.log(`📱 Mobile viewport: ${viewport?.width}x${viewport?.height}`);
      
      // Check that menu items are visible on mobile
      const menuItems = await page.locator('[data-testid="menu-item"]').count();
      expect(menuItems).toBeGreaterThan(0);
      
      console.log(`✅ Mobile layout rendered with ${menuItems} items`);
      
      // Add item on mobile
      const firstItem = page.locator('[data-testid="menu-item"]').first();
      await firstItem.locator('button').first().click();
      
      // Verify mobile cart button is visible and responsive
      const cartButton = page.locator('[data-testid="cart-button"]');
      await expect(cartButton).toBeVisible();
      
      console.log('✅ Mobile cart functionality works');
      
    } finally {
      await context.close();
    }
  });
});

test.describe('Dashboard Mobile Responsiveness', () => {
  test('Admin dashboard is responsive on tablet', async ({ browser }) => {
    const { iPad } = require('@playwright/test').devices;
    const context = await browser.newContext({
      ...iPad,
      baseURL: 'http://localhost:3000',
    });

    const page = await context.newPage();

    try {
      // Login
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@test.com');
      await page.fill('input[type="password"]', 'Admin@123456');
      await page.locator('button:has-text("Login")').click();
      
      // Navigate to orders
      await page.waitForURL('/dashboard/**');
      await page.goto('/dashboard/orders');
      
      // Verify responsive behavior
      const viewport = page.viewportSize();
      console.log(`📱 Tablet viewport: ${viewport?.width}x${viewport?.height}`);
      
      // Check that table/list is visible
      const ordersList = page.locator('[data-testid="orders-list"]');
      await expect(ordersList).toBeVisible();
      
      console.log('✅ Dashboard is responsive on tablet');
      
    } finally {
      await context.close();
    }
  });
});
