export type Action = 'read' | 'create' | 'update' | 'delete';
export type ResourceType = 'document' | 'file';
export type RoleType = 'user' | 'admin';

export type Role = {
	id: RoleType;
	permissions: Action[];
};

export type User = {
	id: string;
	roles: Role[];
	attributes: Record<string, unknown>;
};

export type Resource = {
	id: string;
	type: ResourceType;
	attributes: Record<string, unknown>;
};

export type Policy = {
	action: Action;
	resource: ResourceType;
	conditions: Record<string, unknown>;
};

export class Auth {
	constructor(private readonly policies: Policy[]) {}

	private rbac(user: User, action: Action) {
		const isRoleAuthorized = user.roles.some((role) =>
			role.permissions.includes(action)
		);
		if (isRoleAuthorized) return true;

		return false;
	}

	private abac(user: User, action: Action, resource: Resource) {
		const relevantPolicies = this.policies.filter((policy) => {
			return policy.resource === resource.type && policy.action === action;
		});

		for (const policy of relevantPolicies) {
			for (const key in policy.conditions) {
				if (!resource.attributes[key] || !user.attributes[key]) {
					continue;
				}

				if (
					resource.attributes[key] === policy.conditions[key] &&
					user.attributes[key] === policy.conditions[key]
				) {
					return true;
				}
			}
		}

		return false;
	}

	isAuthorized(user: User, resource: Resource, action: Action) {
		if (this.rbac(user, action)) return true;

		if (this.abac(user, action, resource)) return true;

		return false;
	}
}
