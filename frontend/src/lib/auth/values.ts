import { Auth, Policy, Resource, Role, User } from './main';

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
	},
};

const file1: Resource = {
	id: '1',
	type: 'file',
	attributes: {
		department: 'finance',
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
	attributes: { department: 'engineering' },
};

const userUser_2: User = {
	id: '3',
	roles: [user],
	attributes: { department: 'engineering', level: 6 },
};

const policies: Policy[] = [
	{
		action: 'read',
		resource: 'document',
		conditions: { department: { operator: 'eq', value: 'engineering' } },
	},
	{
		action: 'update',
		resource: 'document',
		// any one of the conditions must be true
		conditions: {
			department: { operator: 'eq', value: 'engineering' },
			level: { operator: 'gt', value: 10 },
		},
	},
	{
		action: 'delete',
		resource: 'file',
		conditions: { level: { operator: 'gt', value: 5 } },
	},
];

const auth = new Auth(policies);

const tests = [
	() =>
		console.assert(
			auth.isAuthorized(adminUser, doc1, 'update'),
			'admin should be authorized to update document'
		),

	() =>
		console.assert(
			auth.isAuthorized(userUser_1, doc1, 'update'),
			'user in engineering should be authorized to update document in engineering'
		),

	() =>
		console.assert(
			auth.isAuthorized(userUser_1, doc1, 'update'),
			'user in engineering should not be authorized to update document in finance'
		),

	() =>
		console.assert(
			!auth.isAuthorized(userUser_1, file1, 'delete'),
			'user with no level should not be authorized to delete file'
		),

	// this fails because the attribute might be missing from the resource
	() =>
		console.assert(
			auth.isAuthorized(userUser_2, file1, 'delete'),
			'user with level 6 should be authorized to delete file level 5'
		),
];

tests.forEach((test, i) => {
	console.log('-------------------');
	console.log(`Test ${i + 1}`);
	test();
});
