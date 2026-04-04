import { redirect } from 'next/navigation';

/**
 * Staff Invitation Page
 * Redirects to the actual invitation acceptance page
 */
export default function StaffInvitationPage() {
  redirect('/auth/accept-invitation');
}
