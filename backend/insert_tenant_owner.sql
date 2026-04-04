-- Create a test tenant
INSERT INTO tenants (id, name, slug, email, phone, currency, created_at, updated_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  'Test Restaurant',
  'test-restaurant',
  'restaurant@example.com',
  '+250123456789',
  'RWF',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Create a TENANT_OWNER user linked to that tenant
INSERT INTO users (id, name, email, password_hash, role, tenant_id, created_at, updated_at)
VALUES (
  '560e8400-e29b-41d4-a716-446655440001',
  'Restaurant Owner',
  'owner@example.com',
  '$2b$10$ph9pOwwZlKNq2z3wzjyXEO6O.DTMZ0jVk6pm0XHGGfWTNhcJI.8zK',
  'TENANT_OWNER',
  '660e8400-e29b-41d4-a716-446655440001',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
