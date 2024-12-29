import { expect, test } from 'vitest';

import { Auth, Policy, Resource, Role, User } from './engine';

const admin: Role = {
	id: 'admin',
	permissions: ['read', 'create', 'update', 'delete'],
};

const user: Role = {
	id: 'user',
	permissions: ['read', 'create'],
};

const doc1: Resource = {
	id: '1',
	type: 'document',
	attributes: {
		department: 'engineering',
	},
};

const doc2: Resource = {
	id: '2',
	type: 'document',
	attributes: {
		department: 'finance',
		owner: '2',
	},
};

const file1: Resource = {
	id: '1',
	type: 'file',
	attributes: {
		department: 'finance',
		level: 7,
	},
};

const adminUser: User = {
	id: '1',
	roles: [admin],
	attributes: {},
};

const userUser_1: User = {
	id: '2',
	roles: [user],
	attributes: { department: 'engineering', level: 2 },
};

const userUser_2: User = {
	id: '3',
	roles: [user],
	attributes: { department: 'engineering', level: 6 },
};

const userUser_3: User = {
	id: '4',
	roles: [user],
	attributes: {},
};

const policies: Policy[] = [
	{
		action: 'read',
		resource: 'document',
		conditions: {
			operator: 'eq',
			value: 'engineering',
			key: 'department',
		},
	},
	{
		action: 'update',
		resource: 'document',
		// any one of the conditions must be true
		conditions: {
			operator: 'or',
			conditions: [
				{ operator: 'eq', key: 'department', value: 'engineering' },
				{ operator: 'gt', key: 'level', value: 10 },
			],
		},
	},
	{
		action: 'delete',
		resource: 'file',
		conditions: {
			operator: 'or',
			conditions: [
				{ operator: 'gt', key: 'level', value: 5 },
				{ operator: 'owner', key: 'owner' },
			],
		},
	},
	{
		action: 'delete',
		resource: 'document',
		conditions: {
			operator: 'or',
			conditions: [
				{ operator: 'gt', key: 'level', value: 5 },
				{ operator: 'owner', key: 'owner' },
			],
		},
	},
];

const auth = new Auth(policies);

test('admin should be authorized to update document', () => {
	expect(auth.isAuthorized(adminUser, doc1, 'update')).toBe(true);
});

test('user in engineering should be authorized to update document in engineering', () => {
	expect(auth.isAuthorized(userUser_1, doc1, 'update')).toBe(true);
});

test('user in engineering should not be authorized to update document in finance', () => {
	expect(auth.isAuthorized(userUser_1, doc1, 'update')).toBe(false);
});

test('user with no level should not be authorized to delete file', () => {
	expect(auth.isAuthorized(userUser_1, file1, 'delete')).toBe(false);
});

test('user with level 2 should not be authorized to delete file level 7', () => {
	expect(auth.isAuthorized(userUser_1, file1, 'delete')).toBe(false);
});

test('user with level 6 should be authorized to delete file level 7', () => {
	expect(auth.isAuthorized(userUser_2, file1, 'delete')).toBe(true);
});

test('user that is owner should be authorized to delete doc', () => {
	expect(auth.isAuthorized(userUser_1, doc2, 'delete')).toBe(true);
});

test('user that is not owner should not be authorized to delete doc', () => {
	expect(auth.isAuthorized(userUser_2, doc2, 'delete')).toBe(false);
});
test('new user should not be authorized to update file', () => {
	expect(auth.isAuthorized(userUser_3, file1, 'update')).toBe(false);
});
