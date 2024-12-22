const actions = ['read', 'create', 'update', 'delete'] as const;
const resourceTypes = ['document', 'file'] as const;
const roleTypes = ['user', 'admin'] as const;

export type Action = (typeof actions)[number];
export type ResourceType = (typeof resourceTypes)[number];
export type RoleType = (typeof roleTypes)[number];

type Attributes = Record<string, unknown>;

export type Role = {
	id: RoleType;
	permissions: Action[];
};

export type User = {
	id: string;
	roles: Role[];
	attributes: Attributes;
};

export type Resource = {
	id: string;
	type: ResourceType;
	attributes: Attributes;
};

export type Policy = {
	action: Action;
	resource: ResourceType;
	conditions: Attributes;
};

export class Auth {
	constructor(private readonly policies: Policy[]) {
		this.validatePolicies(this.policies);
	}

	isAuthorized(user: User, resource: Resource, action: Action) {
		if (this.rbac(user, action)) return true;

		if (this.abac(user, action, resource)) return true;

		return false;
	}

	// this can later be replaced with zod
	private validatePolicies(policies: Policy[]) {
		for (const policy of policies) {
			this.validatePolicy(policy);
		}
	}

	private validatePolicy(policy: Policy) {
		if (!actions.includes(policy.action)) {
			throw new Error(`Invalid action: ${policy.action}`);
		}

		if (!resourceTypes.includes(policy.resource)) {
			throw new Error(`Invalid resource: ${policy.resource}`);
		}
	}

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
}
