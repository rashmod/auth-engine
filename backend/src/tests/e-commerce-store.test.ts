import { describe, expect, it } from 'vitest';

import { AuthEngine } from '@/engine';
import { PolicyManager } from '@/policy-manager';

/*
 * basic e-commerce app
 * all users can view products
 * only user who made the order and admin can view, update, and cancel the order
 * only admin can create, update, and delete a new product
 *
 */

describe('Basic e-commerce app', () => {
	const resources = ['user', 'product', 'order'] as const;

	const policyManager = new PolicyManager(resources);

	const authenticatedUser = policyManager.createResource({
		id: 'user1',
		type: 'user',
		attributes: { isAuthenticated: true, id: 'user1' },
	});

	const unauthenticatedUser = policyManager.createResource({
		id: 'user2',
		type: 'user',
		attributes: { id: 'user2' },
	});

	const authenticatedAdmin = policyManager.createResource({
		id: 'admin1',
		type: 'user',
		attributes: { isAuthenticated: true, role: 'admin' },
	});

	const unauthenticatedAdmin = policyManager.createResource({
		id: 'admin2',
		type: 'user',
		attributes: { role: 'admin' },
	});

	const product = policyManager.createResource({
		id: 'product1',
		type: 'product',
		attributes: {},
	});

	const user1Order = policyManager.createResource({
		id: 'order1',
		type: 'order',
		attributes: { userId: 'user1' },
	});

	const user2Order = policyManager.createResource({
		id: 'order2',
		type: 'order',
		attributes: { userId: 'user2' },
	});

	policyManager.addPolicies([
		{ resource: 'product', action: 'read' },
		{
			resource: 'product',
			action: 'create',
			conditions: {
				operator: 'and',
				conditions: [
					{
						operator: 'eq',
						attributeKey: '$isAuthenticated',
						referenceValue: true,
						compareSource: 'subject',
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
			resource: 'product',
			action: 'update',
			conditions: {
				operator: 'and',
				conditions: [
					{
						operator: 'eq',
						attributeKey: '$isAuthenticated',
						referenceValue: true,
						compareSource: 'subject',
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
			resource: 'product',
			action: 'delete',
			conditions: {
				operator: 'and',
				conditions: [
					{
						operator: 'eq',
						attributeKey: '$isAuthenticated',
						referenceValue: true,
						compareSource: 'subject',
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
			resource: 'order',
			action: 'create',
			conditions: {
				operator: 'eq',
				attributeKey: '$isAuthenticated',
				referenceValue: true,
				compareSource: 'subject',
			},
		},
		{
			resource: 'order',
			action: 'read',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'and',
						conditions: [
							{
								operator: 'eq',
								attributeKey: '$isAuthenticated',
								referenceValue: true,
								compareSource: 'subject',
							},
							{ operator: 'eq', subjectKey: '$id', resourceKey: '$userId' },
						],
					},
					{
						operator: 'and',
						conditions: [
							{
								operator: 'eq',
								attributeKey: '$isAuthenticated',
								referenceValue: true,
								compareSource: 'subject',
							},
							{
								operator: 'eq',
								attributeKey: '$role',
								referenceValue: 'admin',
								compareSource: 'subject',
							},
						],
					},
				],
			},
		},
		{
			resource: 'order',
			action: 'delete',
			conditions: {
				operator: 'or',
				conditions: [
					{
						operator: 'and',
						conditions: [
							{
								operator: 'eq',
								attributeKey: '$isAuthenticated',
								referenceValue: true,
								compareSource: 'subject',
							},
							{ operator: 'eq', subjectKey: '$id', resourceKey: '$userId' },
						],
					},
					{
						operator: 'and',
						conditions: [
							{
								operator: 'eq',
								attributeKey: '$isAuthenticated',
								referenceValue: true,
								compareSource: 'subject',
							},
							{
								operator: 'eq',
								attributeKey: '$role',
								referenceValue: 'admin',
								compareSource: 'subject',
							},
						],
					},
				],
			},
		},
	]);

	const policies = policyManager.getPolicies();

	const auth = new AuthEngine(policies);

	describe('view product', () => {
		it('should allow non-authenticated user to read a product', () => {
			expect(auth.isAuthorized(unauthenticatedUser, product, 'read')).toBe(true);
		});

		it('should allow authenticated user to read a product', () => {
			expect(auth.isAuthorized(authenticatedUser, product, 'read')).toBe(true);
		});

		it('should allow non-authenticated admin to read a product', () => {
			expect(auth.isAuthorized(unauthenticatedAdmin, product, 'read')).toBe(true);
		});

		it('should allow authenticated admin to read a product', () => {
			expect(auth.isAuthorized(authenticatedAdmin, product, 'read')).toBe(true);
		});
	});

	describe('create order', () => {
		it('should not allow non-authenticated user to make a new order', () => {
			expect(auth.isAuthorized(unauthenticatedUser, user1Order, 'create')).toBe(false);
		});

		it('should allow authenticated user to make a new order', () => {
			expect(auth.isAuthorized(authenticatedUser, user1Order, 'create')).toBe(true);
		});

		it('should not allow non-authenticated admin to make a new order', () => {
			expect(auth.isAuthorized(unauthenticatedAdmin, user1Order, 'create')).toBe(false);
		});

		it('should allow authenticated admin to make a new order', () => {
			expect(auth.isAuthorized(authenticatedAdmin, user1Order, 'create')).toBe(true);
		});
	});

	describe('view order', () => {
		it('should not allow non-authenticated user to view order', () => {
			expect(auth.isAuthorized(unauthenticatedUser, user1Order, 'read')).toBe(false);
		});

		it('should allow authenticated user to view own order', () => {
			expect(auth.isAuthorized(authenticatedUser, user1Order, 'read')).toBe(true);
		});

		it('should not allow authenticated user to view other users order', () => {
			expect(auth.isAuthorized(authenticatedUser, user2Order, 'read')).toBe(false);
		});

		it('should not allow non-authenticated admin to view order', () => {
			expect(auth.isAuthorized(unauthenticatedAdmin, user1Order, 'read')).toBe(false);
		});

		it('should allow authenticated admin to view orders', () => {
			expect(auth.isAuthorized(authenticatedAdmin, user1Order, 'read')).toBe(true);
		});
	});

	describe('cancel order', () => {
		it('should not allow non-authenticated user to cancel order', () => {
			expect(auth.isAuthorized(unauthenticatedUser, user1Order, 'delete')).toBe(false);
		});

		it('should allow authenticated user to cancel own order', () => {
			expect(auth.isAuthorized(authenticatedUser, user1Order, 'delete')).toBe(true);
		});

		it('should not allow authenticated user to cancel other users order', () => {
			expect(auth.isAuthorized(authenticatedUser, user2Order, 'delete')).toBe(false);
		});

		it('should not allow non-authenticated admin to cancel order', () => {
			expect(auth.isAuthorized(unauthenticatedAdmin, user1Order, 'delete')).toBe(false);
		});

		it('should allow authenticated admin to cancel orders', () => {
			expect(auth.isAuthorized(authenticatedAdmin, user1Order, 'delete')).toBe(true);
		});
	});

	describe('create product', () => {
		it('should not allow non-authenticated user to create a product', () => {
			expect(auth.isAuthorized(unauthenticatedUser, product, 'create')).toBe(false);
		});

		it('should not allow authenticated user to create a product', () => {
			expect(auth.isAuthorized(authenticatedUser, product, 'create')).toBe(false);
		});

		it('should not allow non-authenticated admin to create a product', () => {
			expect(auth.isAuthorized(unauthenticatedAdmin, product, 'create')).toBe(false);
		});

		it('should allow authenticated admin to create a product', () => {
			expect(auth.isAuthorized(authenticatedAdmin, product, 'create')).toBe(true);
		});
	});

	describe('update product', () => {
		it('should not allow non-authenticated user to update a product', () => {
			expect(auth.isAuthorized(unauthenticatedUser, product, 'update')).toBe(false);
		});

		it('should not allow authenticated user to update a product', () => {
			expect(auth.isAuthorized(authenticatedUser, product, 'update')).toBe(false);
		});

		it('should not allow non-authenticated admin to update a product', () => {
			expect(auth.isAuthorized(unauthenticatedAdmin, product, 'update')).toBe(false);
		});

		it('should allow authenticated admin to update a product', () => {
			expect(auth.isAuthorized(authenticatedAdmin, product, 'update')).toBe(true);
		});
	});

	describe('delete product', () => {
		it('should not allow non-authenticated user to delete a product', () => {
			expect(auth.isAuthorized(unauthenticatedUser, product, 'delete')).toBe(false);
		});

		it('should not allow authenticated user to delete a product', () => {
			expect(auth.isAuthorized(authenticatedUser, product, 'delete')).toBe(false);
		});

		it('should not allow non-authenticated admin to delete a product', () => {
			expect(auth.isAuthorized(unauthenticatedAdmin, product, 'delete')).toBe(false);
		});

		it('should allow authenticated admin to delete a product', () => {
			expect(auth.isAuthorized(authenticatedAdmin, product, 'delete')).toBe(true);
		});
	});
});
