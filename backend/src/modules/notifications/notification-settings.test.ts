import { expect, it } from 'vitest';
import { notificationSettingsTab, NotificationTypes } from '@leadcrm/shared';

it.each([
  ['user_created', 'users'], ['user_status_changed', 'users'], ['user_role_changed', 'users'],
  ['role_created', 'roles'], ['role_archived', 'roles'], ['role_permissions_changed', 'roles'],
  ['password_expiring_soon', 'profile'],
])('maps %s only to its authorized Settings destination', (type, tab) => {
  expect(notificationSettingsTab(type, `/settings?tab=${tab}`)).toBe(tab);
  expect(notificationSettingsTab(type, '/settings?tab=org-general')).toBeUndefined();
  expect(notificationSettingsTab(type, '/inbox')).toBeUndefined();
});

it('keeps password actions and query ordering while rejecting unrelated events and destinations', () => {
  expect(notificationSettingsTab('password_expiring_soon', '/settings?changePassword=1&tab=profile')).toBe('profile');
  for (const type of [...NotificationTypes.filter(type => !['password_expiring_soon', 'user_created', 'user_status_changed', 'user_role_changed',
    'role_created', 'role_archived', 'role_permissions_changed'].includes(type)), 'unknown_event', 'toString']) {
    expect(notificationSettingsTab(type, '/settings?tab=users')).toBeUndefined();
  }
  for (const path of ['/settings', '/settings/other?tab=users', '/other?tab=users', '//example.test/settings?tab=users']) {
    expect(notificationSettingsTab('user_created', path)).toBeUndefined();
  }
});
