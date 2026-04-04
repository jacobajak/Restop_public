// Tenant Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  logo_url?: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

// User Types
export interface User {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_OWNER' | 'TENANT_STAFF' | 'ADMIN' | 'STAFF';
  slug?: string;
  created_at?: string;
}

// Menu Types
export interface MenuCategory {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  created_at: string;
}

export interface Menu {
  tenant: Tenant;
  categories: MenuCategory[];
  items: MenuItem[];
}

// Cart Types
export interface CartItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  platform_fee: number;
  total: number;
  table_number?: number; // For dine-in orders
  table_id?: string; // UUID reference to specific table
}

// Order Types
export type OrderStatus =
  | 'CREATED'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'REJECTED';

export type PaymentMethod = 'CASH' | 'MTN' | 'AIRTEL';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type TransactionKind = 'CASHIN' | 'CASHOUT';
export type PayoutStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';
export type CommissionStatus = 'PENDING' | 'SETTLED';

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  tenant_id: string;
  order_number: string;
  order_code: string; // Short customer-facing code (e.g., "ORD-1234ABCD")
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  platform_fee: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  tx_ref?: string; // Unique transaction reference for idempotency
  paypack_cashin_ref?: string; // Paypack cashin reference ID
  phone_number?: string; // Phone number for Mobile Money payments
  transaction_ref?: string; // Transaction ID from payment provider
  created_at: string;
  updated_at: string;
  table_id?: string; // UUID reference to specific table (null for general orders)
  table_number?: number; // Table number for dine-in orders (null for counter orders)
}

// Payment Transaction Types (tracks cashin and cashout)
export interface PaymentTransaction {
  id: string;
  order_id: string;
  tenant_id: string;
  provider: string; // 'PAYPACK'
  kind: TransactionKind; // 'CASHIN' | 'CASHOUT'
  provider_ref: string; // Paypack transaction reference
  amount: number;
  status: string; // 'pending' | 'successful' | 'failed'
  raw_payload?: Record<string, any>;
  created_at: string;
}

// Payout Types (tracks instant payout to tenant)
export interface Payout {
  id: string;
  order_id: string;
  tenant_id: string;
  tenant_payment_account_id: string;
  amount: number;
  status: PayoutStatus;
  provider_ref?: string; // Paypack cashout reference
  raw_payload?: Record<string, any>;
  created_at: string;
}

// Commission Types (ledger entry)
export interface Commission {
  id: string;
  order_id: string;
  tenant_id: string;
  commission_rate: number;
  amount: number;
  status: CommissionStatus;
  created_at: string;
}

// Legacy Payment interface (kept for backward compatibility)
export interface Payment {
  id: string;
  tenant_id: string;
  order_id: string;
  method: PaymentMethod;
  phone_number?: string;
  transaction_ref?: string;
  status: PaymentStatus;
  error_message?: string;
  webhook_payload?: string;
  created_at: string;
  updated_at: string;
}

// QR Code Types
export interface QRCode {
  id: string;
  tenant_id: string;
  qr_url: string;
  created_at: string;
}

// Analytics Types
export interface DailySales {
  date: string;
  orders_count: number;
  revenue: number;
  top_item: string;
}

export interface Analytics {
  total_revenue: number;
  total_orders: number;
  top_items: MenuItem[];
  daily_sales: DailySales[];
  average_order_value: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
