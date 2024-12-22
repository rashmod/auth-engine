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

const adminUser: User = {
	id: '1',
	roles: [admin],
	attributes: {},
};

const userUser: User = {
	id: '2',
	roles: [user],
	attributes: { department: 'engineering' },
};

const policies: Policy[] = [
	{
		action: 'read',
		resource: 'document',
		conditions: { department: 'engineering' },
	},
	{
		action: 'update',
		resource: 'document',
		conditions: { department: 'engineering' },
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
			auth.isAuthorized(userUser, doc1, 'update'),
			'user in engineering should be authorized to update document in engineering'
		),

	() =>
		console.assert(
			!auth.isAuthorized(userUser, doc2, 'update'),
			'user in engineering should not be authorized to update document in finance'
		),
];

tests.forEach((test, i) => {
	console.log(`Test ${i + 1}`);
	test();
});
