# DineFlow Component Library

Professional, accessible, and consistent UI components built with React, TypeScript, and Tailwind CSS. All components follow the DineFlow design system.

## Table of Contents

1. [Button](#button)
2. [Card](#card)
3. [Badge](#badge)
4. [Table](#table)
5. [Form Inputs](#form-inputs)
6. [Modal](#modal)
7. [Toast](#toast)
8. [Loading States](#loading-states)
9. [Design Tokens](#design-tokens)

---

## Button

Versatile button component with multiple variants, sizes, and states.

### Usage

```tsx
import { Button } from '@/components/common';

// Basic button
<Button>Click me</Button>

// Variants: primary, secondary, danger, success, ghost
<Button variant="danger">Delete</Button>

// Sizes: sm, md, lg
<Button size="lg">Large Button</Button>

// Loading state
<Button loading>Processing...</Button>

// Full width
<Button fullWidth>Submit</Button>

// Disabled
<Button disabled>Disabled</Button>
```

### Props

- `variant`: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `loading`: boolean
- `fullWidth`: boolean
- `disabled`: boolean
- `className`: string for additional Tailwind classes

---

## Card

Flexible container for organizing content with consistent styling.

### Usage

```tsx
import { Card, CardSection, MetricCard } from '@/components/common';

// Basic card
<Card>
  <p>Card content</p>
</Card>

// Card with section
<Card>
  <CardSection title="Revenue">
    <p>$1,234.56</p>
  </CardSection>
</Card>

// Metric card (for KPIs)
<MetricCard
  label="Total Orders"
  value={156}
  color="primary"
  trend={{ direction: 'up', percentage: 12 }}
/>

// Hoverable card
<Card hoverable onClick={() => navigate('/details')}>
  <p>Click me</p>
</Card>
```

### Props

**Card:**
- `hoverable`: boolean
- `noPadding`: boolean
- `className`: string

**MetricCard:**
- `label`: string
- `value`: string | number
- `icon`: React.ReactNode
- `trend`: { direction: 'up' | 'down'; percentage: number }
- `color`: 'primary' | 'success' | 'warning' | 'error' | 'info' (default: 'primary')

---

## Badge

Compact status indicators and metadata tags.

### Usage

```tsx
import { Badge, StatusBadge, TagBadge, CountBadge } from '@/components/common';

// Basic badge
<Badge variant="info">New</Badge>

// Status badge (maps order status to color)
<StatusBadge status="PREPARING" showIcon />

// Tag badge with remove button
<TagBadge onRemove={handleRemove}>react</TagBadge>

// Count badge (for notifications)
<CountBadge count={5} maxDisplay={99} />
```

### Props

**Badge:**
- `variant`: 'info' | 'warning' | 'success' | 'error' | 'neutral'
- `size`: 'sm' | 'md' (default: 'md')

**StatusBadge:**
- `status`: 'NEW' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'REJECTED'
- `showIcon`: boolean

**CountBadge:**
- `count`: number
- `maxDisplay`: number (default: 99)

---

## Table

Data table with sorting, filtering, and responsive design.

### Usage

```tsx
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, DataTable } from '@/components/common';

// Manual table
<Table>
  <TableHead>
    <TableRow>
      <TableHeaderCell sortable>Order ID</TableHeaderCell>
      <TableHeaderCell>Status</TableHeaderCell>
    </TableRow>
  </TableHead>
  <TableBody>
    <TableRow hoverable>
      <TableCell>#1234</TableCell>
      <TableCell>Ready</TableCell>
    </TableRow>
  </TableBody>
</Table>

// Data table (with automatic sorting)
<DataTable
  data={orders}
  columns={[
    { key: 'id', label: 'Order ID', sortable: true },
    { key: 'status', label: 'Status', render: (status) => <StatusBadge status={status} /> },
    { key: 'total', label: 'Total', align: 'right' },
  ]}
  onRowClick={(row) => navigate(`/orders/${row.id}`)}
/>
```

### Props

**DataTable:**
- `data`: T[]
- `columns`: Array of column configs
- `onRowClick`: (row: T) => void
- `loading`: boolean
- `emptyMessage`: string

---

## Form Inputs

Comprehensive form components with validation support.

### Usage

```tsx
import { Input, Textarea, Select, Checkbox, Radio, FormGroup, FormRow } from '@/components/common';

// Text input
<Input
  label="Email"
  type="email"
  placeholder="user@example.com"
  error={errors.email}
  required
/>

// Textarea
<Textarea
  label="Description"
  rows={5}
  hint="Max 500 characters"
/>

// Select
<Select
  label="Status"
  options={[
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
  ]}
/>

// Checkbox
<Checkbox
  label="I agree to terms"
  error={errors.agree}
/>

// Radio
<Radio
  label="Option A"
  name="choice"
  value="a"
/>

// Form layout
<FormGroup>
  <FormRow columns={2}>
    <Input label="First Name" />
    <Input label="Last Name" />
  </FormRow>
  <Input label="Email" />
</FormGroup>
```

### Props

**Input/Textarea/Select:**
- `label`: string
- `error`: string
- `hint`: string
- `required`: boolean
- `disabled`: boolean
- `containerClassName`: string

**Select (additional):**
- `options`: Array of { value, label, disabled? }
- `placeholder`: string

---

## Modal

Dialog boxes for alerts, confirmations, and custom content.

### Usage

```tsx
import { Modal, ConfirmModal, AlertModal } from '@/components/common';

// Basic modal
<Modal isOpen={open} onClose={handleClose} title="Order Details">
  <p>Order content here</p>
</Modal>

// Confirm modal
<ConfirmModal
  isOpen={confirm}
  title="Confirm deletion?"
  message="This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  danger
  onConfirm={handleDelete}
  onCancel={() => setConfirm(false)}
/>

// Alert modal
<AlertModal
  isOpen={alert}
  type="success"
  title="Success!"
  message="Order placed successfully."
  onClose={() => setAlert(false)}
/>
```

### Props

**Modal:**
- `isOpen`: boolean
- `onClose`: () => void
- `title`: string
- `size`: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
- `closeButton`: boolean
- `backdrop`: boolean

---

## Toast

Temporary notifications for user feedback.

### Usage

```tsx
import { useToast, ToastProvider } from '@/components/common';

// In your app root
<ToastProvider>
  <App />
</ToastProvider>

// In components
const { success, error, warning, info } = useToast();

// Show notifications
success('Order placed successfully!');
error('Failed to update order');
warning('This action is irreversible');
info('Loading your orders...');

// With action
const id = useToast().toast({
  message: 'Undo this action?',
  type: 'info',
  action: {
    label: 'Undo',
    onClick: () => handleUndo(),
  },
});
```

### Hook Return

```typescript
{
  toast: (options) => string,  // Show toast, returns ID
  success: (message, duration) => string,
  error: (message, duration) => string,
  warning: (message, duration) => string,
  info: (message, duration) => string,
  remove: (id) => void,
  clear: () => void,
}
```

---

## Loading States

Components for displaying loading, skeleton, and progress states.

### Usage

```tsx
import { Spinner, Loading, Skeleton, ProgressBar } from '@/components/common';

// Spinner
<Spinner size="md" color="primary" />

// Loading state
<Loading message="Loading orders..." />

// Full page loading
<Loading fullPage message="Initializing..." />

// Skeleton loader
<Skeleton width={300} height={20} />
<Skeleton circle width={40} height={40} />

// Progress bar
<ProgressBar
  value={65}
  max={100}
  label="Upload progress"
  showPercentage
  color="primary"
/>
```

---

## Design Tokens

All components use centralized design tokens from `@/constants/design.ts`:

```typescript
import { COLORS, TYPOGRAPHY, SPACING, SIZES } from '@/constants/design';

// Colors
console.log(COLORS.primary[500]); // #F97316
console.log(COLORS.semantic.success); // #22C55E

// Colors for order status
import { ORDER_STATUS_COLORS } from '@/constants/design';
// NEW → info, PREPARING → warning, READY → success, REJECTED → error

// Typography
console.log(TYPOGRAPHY.pageTitle); // { size: '2.5rem', weight: 'bold' }

// Spacing
console.log(SPACING.md); // 1rem (16px)

// Component rules
console.log(SIZES.button.md); // { height: '2.5rem', padding: '0.5rem 1rem' }
```

---

## Best Practices

1. **Always use design tokens** - Avoid hardcoding colors, sizes, or spacing values
2. **Accessibility first** - All components have WCAG 2.1 AA compliance built-in
3. **Dark mode support** - All components automatically support dark mode
4. **TypeScript** - Full type safety with proper generics and interfaces
5. **Consistent spacing** - Use FormRow and FormGroup for aligned layouts
6. **Error handling** - Show error states on inputs and modals for user guidance
7. **Loading states** - Always provide loading feedback for async operations

---

## Import Path

All components can be imported from a single path:

```typescript
import {
  Button,
  Card,
  Badge,
  Table,
  Input,
  Modal,
  useToast,
  Spinner,
} from '@/components/common';
```

---

## Theme Customization

All design tokens are defined in:
- **Tailwind Config**: `frontend/tailwind.config.js`
- **Design Constants**: `frontend/src/constants/design.ts`

To customize the theme, update these files. All components will automatically use the new tokens.
