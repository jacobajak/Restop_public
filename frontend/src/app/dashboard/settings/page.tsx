/**
 * Settings Root Redirect
 * Redirects /dashboard/settings to /dashboard/settings/profile
 */

import { redirect } from 'next/navigation';

export default function SettingsRootPage() {
  redirect('/dashboard/settings/profile');
}
