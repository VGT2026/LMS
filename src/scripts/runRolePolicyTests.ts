import assert from 'assert';
import {
  canAssignRole,
  canCreateAdminUser,
  hasAdminPanelAccess,
  isValidUserRole,
} from '../utils/rolePolicy';

function test(name: string, fn: () => void): void {
  fn();
  console.log(`✓ ${name}`);
}

try {
  test('superadmin can create admin → policy allows', () => {
    assert.equal(canCreateAdminUser('superadmin'), true);
  });

  test('admin calls create-admin → policy denies', () => {
    assert.equal(canCreateAdminUser('admin'), false);
  });

  test('admin patches role to admin → policy denies', () => {
    assert.equal(canAssignRole('admin', 'admin'), false);
  });

  test('superadmin patches role to admin → policy allows', () => {
    assert.equal(canAssignRole('superadmin', 'admin'), true);
  });

  test('admin cannot promote to superadmin', () => {
    assert.equal(canAssignRole('admin', 'superadmin'), false);
  });

  test('admin panel access for new admin login scenario', () => {
    assert.equal(hasAdminPanelAccess('admin'), true);
  });

  test('superadmin role is valid', () => {
    assert.equal(isValidUserRole('superadmin'), true);
  });

  console.log('\nAll superadmin security policy tests passed.');
} catch (err) {
  console.error('\nTest failed:', err);
  process.exit(1);
}
