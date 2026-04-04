/**
 * Common Components Index
 * 
 * Centralized exports for all common UI components following the DineFlow design system.
 */

// Button
export { Button } from './Button';

// Card
export { Card, CardSection, MetricCard } from './Card';

// Badge
export { Badge, StatusBadge, TagBadge, CountBadge } from './Badge';

// Table
export {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  DataTable,
} from './Table';

// Form Inputs
export {
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  FormGroup,
  FormRow,
} from './Input';

// Modal
export { Modal, ConfirmModal, AlertModal } from './Modal';

// Toast
export {
  Toast,
  ToastProvider,
  useToast,
  ToastContext,
  type ToastType,
} from './Toast';

// Spinner & Loading
export { Spinner, Loading, Skeleton, ProgressBar } from './Spinner';

// Protected Content (Role-based)
export { ProtectedContent, ProtectedPage, RoleBased } from './ProtectedContent';

// Theme
export { ThemeToggle } from './ThemeToggle';