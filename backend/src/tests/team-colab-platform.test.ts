import { describe, expect, it } from 'vitest';

import { Auth } from '@/engine';
import { PolicyManager } from '@/policy-generator';

/*
 * team collaboration platform
 * only project members can view tasks or files in a project
 * only task assignee or project manager can update a task
 * only project manager can delete task or files
 * only project manager can add or remove project members
 * admins can manage all resources
 *
 */

describe('Basic team collaboration app', () => {
	const resources = ['project', 'task', 'file'] as const;

	const policyGenerator = new PolicyManager(resources);

	policyGenerator.addPolicies([
		{
			resource: 'task',
			action: 'read',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'contains',
						referenceKey: '$projectId',
						collectionKey: '$projects',
						collectionSource: 'user',
					},
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
			resource: 'file',
			action: 'read',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'contains',
						referenceKey: '$projectId',
						collectionKey: '$projects',
						collectionSource: 'user',
					},
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
			resource: 'task',
			action: 'update',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'owner',
						ownerKey: 'id',
						resourceKey: 'assignee',
					},
					{
						operator: 'eq',
						attributeKey: 'role',
						referenceValue: 'admin',
						compareSource: 'user',
					},
					{
						operator: 'and',
						conditions: [
							{
								operator: 'contains',
								referenceKey: '$projectId',
								collectionKey: '$projects',
								collectionSource: 'user',
							},
							{
								operator: 'owner',
								ownerKey: 'id',
								resourceKey: 'manager',
							},
						],
					},
				],
			},
		},
		{
			action: 'delete',
			resource: 'task',
			conditions: {
				operator: 'or',
				conditions: [
					{ operator: 'owner', ownerKey: 'id', resourceKey: 'manager' },
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
			action: 'update',
			resource: 'project',
			conditions: {
				operator: 'or',
				conditions: [
					{ operator: 'owner', ownerKey: 'id', resourceKey: 'manager' },
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

	const user1 = policyGenerator.createUser({
		id: 'user1',
		attributes: { id: 'user1', projects: ['project1'] },
	});

	const user2 = policyGenerator.createUser({
		id: 'user2',
		attributes: { projects: ['project2'] },
	});

	const user3 = policyGenerator.createUser({
		id: 'user3',
		attributes: { projects: ['project1'] },
	});

	const manager1 = policyGenerator.createUser({
		id: 'user4',
		attributes: { id: 'user4', projects: ['project1'] },
	});

	const manager2 = policyGenerator.createUser({
		id: 'user5',
		attributes: { id: 'user5', projects: ['project2'] },
	});

	const admin = policyGenerator.createUser({
		id: 'admin',
		attributes: { role: 'admin' },
	});

	const project1 = policyGenerator.createResource({
		id: 'project1',
		type: 'project',
		attributes: { members: ['user1', 'user3', 'user4'], manager: 'user4' },
	});

	const task1 = policyGenerator.createResource({
		id: 'task1',
		type: 'task',
		attributes: { projectId: 'project1', assignee: 'user1', manager: 'user4' },
		// the manager field is embedded at runtime
	});

	const file1 = policyGenerator.createResource({
		id: 'file1',
		type: 'file',
		attributes: { projectId: 'project1' },
	});

	const policies = policyGenerator.getPolicies();

	const auth = new Auth(policies);

	describe('view tasks', () => {
		it('should allow project members to view tasks', () => {
			expect(auth.isAuthorized(user1, task1, 'read')).toBe(true);
		});

		it('should not allow non-project members to view tasks', () => {
			expect(auth.isAuthorized(user2, task1, 'read')).toBe(false);
		});

		it('should allow admin to view tasks', () => {
			expect(auth.isAuthorized(admin, task1, 'read')).toBe(true);
		});
	});

	describe('view files', () => {
		it('should allow project members to view files', () => {
			expect(auth.isAuthorized(user1, file1, 'read')).toBe(true);
		});

		it('should not allow non-project members to view files', () => {
			expect(auth.isAuthorized(user2, file1, 'read')).toBe(false);
		});

		it('should allow admin to view files', () => {
			expect(auth.isAuthorized(admin, file1, 'read')).toBe(true);
		});
	});

	describe('update tasks', () => {
		it('should allow assignee to update tasks', () => {
			expect(auth.isAuthorized(user1, task1, 'update')).toBe(true);
		});

		it('should not allow project members to update tasks', () => {
			expect(auth.isAuthorized(user3, task1, 'update')).toBe(false);
		});

		it('should not allow non-project members to update tasks', () => {
			expect(auth.isAuthorized(user2, task1, 'update')).toBe(false);
		});

		it('should allow project manager to update tasks', () => {
			expect(auth.isAuthorized(manager1, task1, 'update')).toBe(true);
		});

		it('should not allow project manager of different project to update tasks', () => {
			expect(auth.isAuthorized(manager2, task1, 'update')).toBe(false);
		});

		it('should allow admin to update tasks', () => {
			expect(auth.isAuthorized(admin, task1, 'update')).toBe(true);
		});
	});

	describe('delete tasks', () => {
		it('should not allow assignee to delete tasks', () => {
			expect(auth.isAuthorized(user1, task1, 'delete')).toBe(false);
		});

		it('should not allow project members to delete tasks', () => {
			expect(auth.isAuthorized(user3, task1, 'delete')).toBe(false);
		});

		it('should not allow non-project members to delete tasks', () => {
			expect(auth.isAuthorized(user2, task1, 'delete')).toBe(false);
		});

		it('should allow project manager to delete tasks', () => {
			expect(auth.isAuthorized(manager1, task1, 'delete')).toBe(true);
		});

		it('should not allow project manager of different project to delete tasks', () => {
			expect(auth.isAuthorized(manager2, task1, 'delete')).toBe(false);
		});

		it('should allow admin to delete tasks', () => {
			expect(auth.isAuthorized(admin, task1, 'delete')).toBe(true);
		});
	});

	describe('update project', () => {
		it('should not allow project members to update project', () => {
			expect(auth.isAuthorized(user1, project1, 'update')).toBe(false);
		});

		it('should not allow non-project members to update project', () => {
			expect(auth.isAuthorized(user2, project1, 'delete')).toBe(false);
		});

		it('should allow project manager to update project', () => {
			expect(auth.isAuthorized(manager1, project1, 'update')).toBe(true);
		});

		it('should not allow project manager of different project to update project', () => {
			expect(auth.isAuthorized(manager2, project1, 'update')).toBe(false);
		});

		it('should allow admin to update project', () => {
			expect(auth.isAuthorized(admin, project1, 'update')).toBe(true);
		});
	});
});
