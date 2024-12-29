import { Policy } from './engine';

const policies: Policy[] = [
	{
		action: 'create',
		resource: 'todo',
		conditions: { operator: 'in', key: 'role', value: ['user', 'admin'] },
	},
	{
		action: 'read',
		resource: 'todo',
		conditions: { operator: 'in', key: 'role', value: ['user', 'admin'] },
	},
	{
		action: 'update',
		resource: 'todo',
		conditions: { operator: 'owner', key: 'ownerId' },
	},
	{
		action: 'delete',
		resource: 'todo',
		conditions: {
			operator: 'or',
			conditions: [
				{ operator: 'owner', key: 'ownerId' },
				{ operator: 'eq', key: 'role', value: 'admin' },
			],
		},
	},
];

export default policies;
