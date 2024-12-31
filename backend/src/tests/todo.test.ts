import { describe, expect, it } from 'vitest';

import { Auth, Policy, Resource, User } from '@/engine';

describe('Basic todo app', () => {
	const resources = ['todo'] as const;

	const policies: Policy<(typeof resources)[number]>[] = [
		{
			action: 'create',
			resource: 'todo',
			conditions: {
				operator: 'in',
				key: 'role',
				value: ['user', 'admin'],
				compare: 'user-only',
			},
		},
		{
			action: 'read',
			resource: 'todo',
			conditions: {
				operator: 'in',
				key: 'role',
				value: ['user', 'admin'],
				compare: 'user-only',
			},
		},
		{
			action: 'update',
			resource: 'todo',
			conditions: {
				operator: 'or',
				conditions: [
					{ operator: 'owner', key: 'ownerId' },
					{ operator: 'eq', key: 'role', value: 'admin', compare: 'user-only' },
				],
			},
		},
		{
			action: 'delete',
			resource: 'todo',
			conditions: {
				operator: 'or',
				conditions: [
					{ operator: 'owner', key: 'ownerId' },
					{ operator: 'eq', key: 'role', value: 'admin', compare: 'user-only' },
				],
			},
		},
	];

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

	const todo: Resource<(typeof resources)[number]> = {
		id: 'todo1',
		type: 'todo',
		attributes: { ownerId: 'user1' },
	};

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
