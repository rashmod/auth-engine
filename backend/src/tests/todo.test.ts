import { describe, expect, it } from 'vitest';

import { Auth } from '@/engine';
import { PolicyManager } from '@/policy-generator';

describe('Basic todo app', () => {
	const resources = ['user', 'todo'] as const;

	const policyGenerator = new PolicyManager(resources);
	policyGenerator.addPolicies([
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
	]);

	const policies = policyGenerator.getPolicies();

	const auth = new Auth(policies);

	const user = policyGenerator.createResource({
		id: 'user1',
		type: 'user',
		attributes: { role: 'user', id: 'user1' },
	});

	const anotherUser = policyGenerator.createResource({
		id: 'user2',
		type: 'user',
		attributes: { role: 'user' },
	});

	const admin = policyGenerator.createResource({
		id: 'admin1',
		type: 'user',
		attributes: { role: 'admin' },
	});

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
