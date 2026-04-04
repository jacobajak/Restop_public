import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('User can register new account', async ({ page }) => {
    await page.goto('/auth/register');

    // Fill registration form
    await page.fill('input[type="email"]', `user-${Date.now()}@test.com`);
    await page.fill('input[type="password"]', 'SecurePass@123');
    await page.fill('input[placeheld*="name" i]', 'Test User');

    // Submit form
    await page.click('button:has-text("Register")');

    // Should redirect to login or dashboard
    await page.waitForURL('/(login|dashboard)/**', { timeout: 10000 });
    console.log('✅ User registration successful');
  });

  test('User can login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test@123456');

    // Submit form
    await page.click('button:has-text("Login")');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard/**', { timeout: 10000 });
    console.log('✅ User login successful');
  });

  test('User cannot login with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill with wrong credentials
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'WrongPassword');

    // Submit form
    await page.click('button:has-text("Login")');

    // Should show error
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    console.log('✅ Invalid credentials properly rejected');
  });

  test('User can logout', async ({ page }) => {
    // First login
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'Test@123456');
    await page.click('button:has-text("Login")');
    await page.waitForURL('/dashboard/**');

    // Click logout
    const logoutButton = page.locator('[data-testid="logout-button"]');
    await logoutButton.click();

    // Should redirect to login
    await page.waitForURL('/auth/login', { timeout: 5000 });
    console.log('✅ User logout successful');
  });
});

test.describe('Menu Management', () => {
  test('Admin can add new menu item', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Login")');
    await page.waitForURL('/dashboard/**');

    // Navigate to menu management
    await page.goto('/dashboard/menu');

    // Click add new item
    await page.click('button:has-text("Add Item")');

    // Fill form
    await page.fill('input[placeholder*="name" i]', 'New Delicious Dish');
    await page.fill('input[placeholder*="price" i]', '5500');
    await page.fill('textarea[placeholder*="description" i]', 'A delicious new dish');

    // Submit
    await page.click('button:has-text("Save")');

    // Should show success message
    const successMsg = page.locator('text=Item added successfully');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
    console.log('✅ Menu item added successfully');
  });

  test('Admin can update menu item', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Login")');
    await page.waitForURL('/dashboard/**');

    await page.goto('/dashboard/menu');

    // Find first item and click edit
    const editButton = page.locator('button:has-text("Edit")').first();
    await editButton.click();

    // Update price
    const priceField = page.locator('input[placeholder*="price" i]');
    await priceField.clear();
    await priceField.fill('6000');

    // Save
    await page.click('button:has-text("Save Changes")');

    // Verify update
    const successMsg = page.locator('text=Item updated successfully');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
    console.log('✅ Menu item updated successfully');
  });

  test('Admin can toggle menu item availability', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Login")');
    await page.waitForURL('/dashboard/**');

    await page.goto('/dashboard/menu');

    // Find first item and toggle availability
    const toggleButton = page.locator('[data-testid="availability-toggle"]').first();
    const initialState = await toggleButton.getAttribute('aria-pressed');

    await toggleButton.click();

    // Verify state changed
    const newState = await toggleButton.getAttribute('aria-pressed');
    expect(newState).not.toBe(initialState);
    console.log('✅ Menu item availability toggled');
  });
});

test.describe('Analytics Dashboard', () => {
  test('Admin can view analytics', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Login")');
    await page.waitForURL('/dashboard/**');

    // Navigate to analytics
    await page.goto('/dashboard/analytics');

    // Verify key metrics are visible
    const totalRevenue = page.locator('[data-testid="total-revenue"]');
    await expect(totalRevenue).toBeVisible();

    const totalOrders = page.locator('[data-testid="total-orders"]');
    await expect(totalOrders).toBeVisible();

    const topItems = page.locator('[data-testid="top-items"]');
    await expect(topItems).toBeVisible();

    // Verify chart is rendered
    const chart = page.locator('canvas, svg[data-testid="sales-chart"]');
    await expect(chart).toBeVisible();

    console.log('✅ Analytics dashboard loaded successfully');
  });
});

test.describe('QR Code Display', () => {
  test('Admin can view and download QR code', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button:has-text("Login")');
    await page.waitForURL('/dashboard/**');

    // Navigate to QR code page
    await page.goto('/dashboard/qrcode');

    // Verify QR code is displayed
    const qrCode = page.locator('[data-testid="qr-code"]');
    await expect(qrCode).toBeVisible();

    // Verify download button
    const downloadButton = page.locator('button:has-text("Download")');
    await expect(downloadButton).toBeVisible();

    console.log('✅ QR code displayed successfully');
  });
});
