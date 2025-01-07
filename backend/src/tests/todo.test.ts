import { describe, expect, it } from 'vitest';

import { Auth } from '@/engine';
import { PolicyManager } from '@/policy-manager';

describe('Basic todo app', () => {
	const resources = ['user', 'todo', 'file'] as const;

	const policyManager = new PolicyManager(resources);
	policyManager.addPolicies([
		{
			action: 'create',
			resource: 'todo',
			conditions: {
				operator: 'in',
				attributeKey: '$role',
				referenceValue: ['user', 'admin'],
				compareSource: 'subject',
			},
		},
		{
			action: 'read',
			resource: 'todo',
			conditions: {
				operator: 'in',
				attributeKey: '$role',
				referenceValue: ['user', 'admin'],
				compareSource: 'subject',
			},
		},
		{
			action: 'update',
			resource: 'todo',
			conditions: {
				operator: 'or',
				conditions: [
					{ operator: 'eq', subjectKey: '$id', resourceKey: '$ownerId' },
					{
						operator: 'eq',
						attributeKey: '$role',
						referenceValue: 'admin',
						compareSource: 'subject',
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
					{ operator: 'eq', subjectKey: '$id', resourceKey: '$ownerId' },
					{
						operator: 'eq',
						attributeKey: '$role',
						referenceValue: 'admin',
						compareSource: 'subject',
					},
				],
			},
		},
		{
			action: 'read',
			resource: 'file',
		},
	]);

	const policies = policyManager.getPolicies();

	const auth = new Auth(policies);

	const user = policyManager.createResource({
		id: 'user1',
		type: 'user',
		attributes: { role: 'user', id: 'user1' },
	});

	const anotherUser = policyManager.createResource({
		id: 'user2',
		type: 'user',
		attributes: { role: 'user' },
	});

	const admin = policyManager.createResource({
		id: 'admin1',
		type: 'user',
		attributes: { role: 'admin' },
	});

	const todo = policyManager.createResource({
		id: 'todo1',
		type: 'todo',
		attributes: { ownerId: 'user1' },
	});

	describe('create todo', () => {
		it('should allow user to create a todo', () => {
			expect(auth.isAuthorized(user, todo, 'create')).toBe(true);
		});

		it('should allow admin to create a todo', () => {
			expect(auth.isAuthorized(admin, todo, 'create')).toBe(true);
		});
	});

	describe('read todo', () => {
		it('should allow user to read a todo', () => {
			expect(auth.isAuthorized(user, todo, 'read')).toBe(true);
		});

		it('should allow admin to read a todo', () => {
			expect(auth.isAuthorized(admin, todo, 'read')).toBe(true);
		});
	});

	describe('update todo', () => {
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
	});

	describe('delete todo', () => {
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

	describe('no policy', () => {
		const file = policyManager.createResource({
			type: 'file',
			id: 'file1',
			attributes: {},
		});

		it('should not allow to create file', () => {
			expect(auth.isAuthorized(user, file, 'create')).toBe(false);
		});

		it('should allow to read file', () => {
			expect(auth.isAuthorized(user, file, 'read')).toBe(true);
		});

		it('should not allow to update file', () => {
			expect(auth.isAuthorized(user, file, 'update')).toBe(false);
		});

		it('should not allow to delete file', () => {
			expect(auth.isAuthorized(user, file, 'delete')).toBe(false);
		});
	});
});
