import { describe, expect, it } from 'vitest';
import { canAccess, hasBackOffice, isStaffRole, roleLevel } from './roles';

describe('rôles', () => {
	it('classe les rôles du client à l’administrateur', () => {
		expect(roleLevel('customer')).toBeLessThan(roleLevel('employee'));
		expect(roleLevel('employee')).toBeLessThan(roleLevel('admin'));
		expect(roleLevel(null)).toBe(roleLevel('customer'));
		expect(roleLevel('inconnu')).toBe(roleLevel('customer'));
	});

	it('ouvre le back-office aux employés et aux administrateurs', () => {
		expect(hasBackOffice('employee')).toBe(true);
		expect(hasBackOffice('admin')).toBe(true);
		expect(hasBackOffice('customer')).toBe(false);
		expect(hasBackOffice(undefined)).toBe(false);
		expect(isStaffRole('customer')).toBe(false);
	});

	it('réserve le paramétrage et l’équipe aux administrateurs', () => {
		expect(canAccess('employee', '/admin/orders/12')).toBe(true);
		expect(canAccess('employee', '/admin/stock-locations')).toBe(true);
		expect(canAccess('employee', '/admin/stock-locations/manage')).toBe(false);
		expect(canAccess('employee', '/admin/team')).toBe(false);
		expect(canAccess('employee', '/admin/taxes/3')).toBe(false);
		expect(canAccess('admin', '/admin/team')).toBe(true);
		expect(canAccess('customer', '/admin/orders')).toBe(false);
	});
});
