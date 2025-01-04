import { describe, expect, it } from 'vitest';

import { Auth } from '@/engine';
import { PolicyManager } from '@/policy-generator';

/*
 * basic blog app
 * any user can read a blog
 * only author can update or delete a blog
 * only logged in user can create a blog
 */

describe('Basic blog app', () => {
	const resources = ['user', 'blog'] as const;

	// is the check for authenticated user necessary for when
	// updating and deleting a blog when we are already checking for ownership

	const policyGenerator = new PolicyManager(resources);
	policyGenerator.addPolicies([
		{
			action: 'create',
			resource: 'blog',
			conditions: {
				operator: 'eq',
				attributeKey: '$isAuthenticated',
				referenceValue: true,
				compareSource: 'subject',
			},
		},
		{
			action: 'read',
			resource: 'blog',
		},
		{
			action: 'update',
			resource: 'blog',
			conditions: {
				operator: 'and',
				conditions: [
					{ operator: 'owner', resourceKey: 'authorId', ownerKey: 'id' },
					{
						operator: 'eq',
						attributeKey: '$isAuthenticated',
						referenceValue: true,
						compareSource: 'subject',
					},
				],
			},
		},
		{
			action: 'delete',
			resource: 'blog',
			conditions: {
				operator: 'and',
				conditions: [
					{ operator: 'owner', resourceKey: 'authorId', ownerKey: 'id' },
					{
						operator: 'eq',
						attributeKey: '$isAuthenticated',
						referenceValue: true,
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
		attributes: { isAuthenticated: true, id: 'user1' },
	});

	const notAuthenticatedUser = policyGenerator.createResource({
		id: 'user2',
		type: 'user',
		attributes: {},
	});

	const authenticatedUser = policyGenerator.createResource({
		id: 'user3',
		type: 'user',
		attributes: { isAuthenticated: true },
	});

	const blog = policyGenerator.createResource({
		id: 'blog1',
		type: 'blog',
		attributes: { authorId: 'user1' },
	});

	it('should allow authenticated user to create a blog', () => {
		expect(auth.isAuthorized(user, blog, 'create')).toBe(true);
	});

	// why do i need the instance of resouce being created when checking if the user can create it
	it('should not allow non-authenticated user to create a blog', () => {
		expect(auth.isAuthorized(notAuthenticatedUser, blog, 'create')).toBe(false);
	});

	it('should allow authenticated user to read a blog', () => {
		expect(auth.isAuthorized(user, blog, 'read')).toBe(true);
	});

	it('should allow non-authenticated user to read a blog', () => {
		expect(auth.isAuthorized(notAuthenticatedUser, blog, 'read')).toBe(true);
	});

	it('should allow author to update a blog', () => {
		expect(auth.isAuthorized(user, blog, 'update')).toBe(true);
	});

	it('should not allow non-authenticated user to update a blog', () => {
		expect(auth.isAuthorized(notAuthenticatedUser, blog, 'update')).toBe(false);
	});

	it('should not allow non-author user to update a blog', () => {
		expect(auth.isAuthorized(authenticatedUser, blog, 'update')).toBe(false);
	});

	it('should allow author to delete a blog', () => {
		expect(auth.isAuthorized(user, blog, 'delete')).toBe(true);
	});

	it('should not allow non-authenticated user to delete a blog', () => {
		expect(auth.isAuthorized(notAuthenticatedUser, blog, 'delete')).toBe(false);
	});

	it('should not allow non-author user to delete a blog', () => {
		expect(auth.isAuthorized(authenticatedUser, blog, 'delete')).toBe(false);
	});
});
