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

export type AdvancedCondition =
	| { value: string | number | boolean; operator: 'eq' | 'ne' }
	| { value: number; operator: 'gt' | 'gte' | 'lt' | 'lte' }
	| { value: unknown[]; operator: 'in' | 'nin' };

export type Policy = {
	action: Action;
	resource: ResourceType;
	conditions: Record<string, AdvancedCondition>;
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
			const isPolicyAuthorized = this.evaluatePolicy(policy, user, resource);
			if (isPolicyAuthorized) return true;
		}

		return false;
	}

	private evaluatePolicy(policy: Policy, user: User, resource: Resource) {
		for (const key in policy.conditions) {
			if (!resource.attributes[key] || !user.attributes[key]) {
				continue;
			}

			const condition = policy.conditions[key];
			const resourceValue = resource.attributes[key];
			const userValue = user.attributes[key];

			const resourceEval = this.evaluateCondition(condition, resourceValue);
			const userEval = this.evaluateCondition(condition, userValue);

			if (resourceEval && userEval) {
				return true;
			}
		}
		return false;
	}

	private evaluateCondition(condition: AdvancedCondition, value: unknown) {
		function isPrimitive(value: unknown) {
			return (
				typeof value === 'string' ||
				typeof value === 'number' ||
				typeof value === 'boolean'
			);
		}

		function validateValue(check: boolean, operator: string, value: unknown) {
			if (!check) {
				throw new InvalidOperandError(value, operator);
			}
		}

		switch (condition.operator) {
			case 'eq':
			case 'ne': {
				validateValue(isPrimitive(value), condition.operator, value);
				const val = value as string | number | boolean;
				return condition.operator === 'eq'
					? val === condition.value
					: val !== condition.value;
			}

			case 'gt':
			case 'gte':
			case 'lt':
			case 'lte': {
				validateValue(typeof value === 'number', condition.operator, value);
				const val = value as number;
				switch (condition.operator) {
					case 'gt':
						return val > condition.value;
					case 'gte':
						return val >= condition.value;
					case 'lt':
						return val < condition.value;
					case 'lte':
						return val <= condition.value;
				}
			}

			case 'in':
			case 'nin': {
				validateValue(Array.isArray(value), condition.operator, value);
				return condition.operator === 'in'
					? condition.value.includes(value)
					: !condition.value.includes(value);
			}
		}
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
}

class InvalidOperandError extends Error {
	constructor(value: unknown, operator: string) {
		super(`Invalid value type: ${typeof value} for condition ${operator}`);
	}
}
