import { describe, expect, it } from 'vitest';

import { Auth } from '@/engine';
import { PolicyGenerator } from '@/policy-generator';
import { User } from '@/schema';

describe('Basic todo app', () => {
	const resources = ['todo'] as const;

	const policyGenerator = new PolicyGenerator(resources);
	policyGenerator.addPolicies([
		{
			action: 'create',
			resource: 'todo',
			conditions: {
				operator: 'in',
				attributeKey: 'role',
				referenceValue: ['user', 'admin'],
				compareSource: 'user',
			},
		},
		{
			action: 'read',
			resource: 'todo',
			conditions: {
				operator: 'in',
				attributeKey: 'role',
				referenceValue: ['user', 'admin'],
				compareSource: 'user',
			},
		},
		{
			action: 'update',
			resource: 'todo',
			conditions: {
				operator: 'or',
				conditions: [
					{ operator: 'owner', ownerKey: 'ownerId' },
					{
						operator: 'eq',
						attributeKey: 'role',
						referenceValue: 'admin',
						compareSource: 'user',
					},
				],
			},
		},
		{
			action: 'delete',
			resource: 'todo',
			conditions: {
				operator: 'or',
				conditions: [
					{ operator: 'owner', ownerKey: 'ownerId' },
					{
						operator: 'eq',
						attributeKey: 'role',
						referenceValue: 'admin',
						compareSource: 'user',
					},
				],
			},
		},
	]);

	const policies = policyGenerator.getPolicies();

	const auth = new Auth(policies);

	const user: User = {
		id: 'user1',
		attributes: { role: 'user' },
	};

	const anotherUser: User = {
		id: 'user2',
		attributes: { role: 'user' },
	};

	const admin: User = {
		id: 'admin1',
		attributes: { role: 'admin' },
	};

	const todo = policyGenerator.createResource({
		id: 'todo1',
		type: 'todo',
		attributes: { ownerId: 'user1' },
	});

	it('should allow user to create a todo', () => {
		expect(auth.isAuthorized(user, todo, 'create')).toBe(true);
	});

	it('should allow admin to create a todo', () => {
		expect(auth.isAuthorized(admin, todo, 'create')).toBe(true);
	});

	it('should allow user to read a todo', () => {
		expect(auth.isAuthorized(user, todo, 'read')).toBe(true);
	});

	it('should allow admin to read a todo', () => {
		expect(auth.isAuthorized(admin, todo, 'read')).toBe(true);
	});

	it('should allow other user to read a todo', () => {
		expect(auth.isAuthorized(user, todo, 'read')).toBe(true);
	});

	it('should allow owner to update a todo', () => {
		expect(auth.isAuthorized(user, todo, 'update')).toBe(true);
	});

	it('should allow admin to update a todo', () => {
		expect(auth.isAuthorized(admin, todo, 'update')).toBe(true);
	});

	it('should not allow other user to update a todo', () => {
		expect(auth.isAuthorized(anotherUser, todo, 'update')).toBe(false);
	});

	it('should allow owner to delete a todo', () => {
		expect(auth.isAuthorized(user, todo, 'delete')).toBe(true);
	});

	it('should allow admin to delete a todo', () => {
		expect(auth.isAuthorized(admin, todo, 'delete')).toBe(true);
	});

	it('should not allow other user to delete a todo', () => {
		expect(auth.isAuthorized(anotherUser, todo, 'delete')).toBe(false);
	});
});
