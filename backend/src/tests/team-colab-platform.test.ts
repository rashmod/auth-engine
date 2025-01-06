import { describe, expect, it } from 'vitest';

import { Auth } from '@/engine';
import { PolicyManager } from '@/policy-generator';

/*
 * team collaboration platform
 * only project members can view tasks or files in a project
 * only task assignee or project manager can update a task
 * only project manager can delete task or files
 * only project manager can add or remove project members
 * file editors in a project and project manager can edit files
 * admins can manage all resources
 *
 */

describe('Basic team collaboration app', () => {
	const resources = ['user', 'project', 'task', 'file'] as const;

	const policyGenerator = new PolicyManager(resources);

	policyGenerator.addPolicies([
		{
			resource: 'task',
			action: 'read',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'in',
						targetKey: '$projects',
						collectionKey: '$projectId',
						collectionSource: 'subject',
					},
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
			resource: 'file',
			action: 'read',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'in',
						targetKey: '$projects',
						collectionKey: '$projectId',
						collectionSource: 'subject',
					},
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
			resource: 'task',
			action: 'update',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'eq',
						subjectKey: '$id',
						resourceKey: '$assignee',
					},
					{
						operator: 'eq',
						attributeKey: '$role',
						referenceValue: 'admin',
						compareSource: 'subject',
					},
					{
						operator: 'and',
						conditions: [
							{
								operator: 'in',
								targetKey: '$projects',
								collectionKey: '$projectId',
								collectionSource: 'subject',
							},
							{
								operator: 'eq',
								subjectKey: '$id',
								resourceKey: '$manager',
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
					{
						operator: 'eq',
						subjectKey: '$id',
						resourceKey: '$manager',
					},
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
			action: 'update',
			resource: 'project',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'eq',
						subjectKey: '$id',
						resourceKey: '$manager',
					},
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
			action: 'update',
			resource: 'file',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'in',
						targetKey: '$id',
						collectionKey: '$editors',
						collectionSource: 'resource',
					},
					{
						operator: 'eq',
						subjectKey: '$id',
						resourceKey: '$manager',
					},
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

	const user1 = policyGenerator.createResource({
		id: 'user1',
		type: 'user',
		attributes: { id: 'user1', projects: ['project1'] },
	});

	const user2 = policyGenerator.createResource({
		id: 'user2',
		type: 'user',
		attributes: { projects: ['project2'] },
	});

	const user3 = policyGenerator.createResource({
		id: 'user3',
		type: 'user',
		attributes: { projects: ['project1'] },
	});

	const manager1 = policyGenerator.createResource({
		id: 'user4',
		type: 'user',
		attributes: { id: 'user4', projects: ['project1'] },
	});

	const manager2 = policyGenerator.createResource({
		id: 'user5',
		type: 'user',
		attributes: { id: 'user5', projects: ['project2'] },
	});

	const admin = policyGenerator.createResource({
		id: 'admin',
		type: 'user',
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

	const file2 = policyGenerator.createResource({
		id: 'file2',
		type: 'file',
		attributes: { projectId: 'project1', editors: ['user1'], manager: 'user4' },
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

	describe('edit file', () => {
		it('should not allow non-project members to update file', () => {
			expect(auth.isAuthorized(user2, file1, 'update')).toBe(false);
		});

		it('should not allow non-editor project members to update file', () => {
			expect(auth.isAuthorized(user3, file2, 'update')).toBe(false);
		});

		it('should allow editor project members to update file', () => {
			expect(auth.isAuthorized(user1, file2, 'update')).toBe(true);
		});

		it('should allow project manager to update file', () => {
			expect(auth.isAuthorized(manager1, file2, 'update')).toBe(true);
		});

		it('should not allow project manager of different project to update file', () => {
			expect(auth.isAuthorized(manager2, file2, 'update')).toBe(false);
		});

		it('should allow admin to update file', () => {
			expect(auth.isAuthorized(admin, file2, 'update')).toBe(true);
		});
	});
});
