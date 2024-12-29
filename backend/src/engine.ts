const actions = ['read', 'create', 'update', 'delete'] as const;

export type Action = (typeof actions)[number];

export type Attributes = Record<string, {}>;

export type Role<RoleType extends string> = {
	id: RoleType;
	permissions: Action[];
};

export type User<RoleType extends string> = {
	id: string;
	roles: Role<RoleType>[];
	attributes: Attributes;
};

export type Resource<ResourceType extends string> = {
	id: string;
	type: ResourceType;
	attributes: Attributes;
};

type OwnerCondition = { key: string; operator: 'owner' };

type AdvancedCondition =
	| { key: string; value: string | number | boolean; operator: 'eq' | 'ne' }
	| { key: string; value: number; operator: 'gt' | 'gte' | 'lt' | 'lte' }
	| { key: string; value: unknown[]; operator: 'in' | 'nin' };

type LogicalCondition =
	| { operator: 'and' | 'or'; conditions: Condition[] }
	| { operator: 'not'; conditions: Condition };

type Condition = AdvancedCondition | LogicalCondition | OwnerCondition;

export type Policy<ResourceType extends string> = {
	action: Action;
	resource: ResourceType;
	conditions?: Condition;
};

export class Auth<RoleType extends string, ResourceType extends string> {
	constructor(private readonly policies: Policy<ResourceType>[]) {}

	isAuthorized(
		user: User<RoleType>,
		resource: Resource<ResourceType>,
		action: Action
	) {
		if (this.rbac(user, action)) return true;

		if (this.abac(user, action, resource)) return true;

		return false;
	}

	private rbac(user: User<RoleType>, action: Action) {
		const isRoleAuthorized = user.roles.some((role) =>
			role.permissions.includes(action)
		);
		if (isRoleAuthorized) return true;

		return false;
	}

	private abac(
		user: User<RoleType>,
		action: Action,
		resource: Resource<ResourceType>
	) {
		const relevantPolicies = this.policies.filter((policy) => {
			return policy.resource === resource.type && policy.action === action;
		});

		for (const policy of relevantPolicies) {
			if (!policy.conditions) return true;

			const isPolicyAuthorized = this.evaluate(
				user,
				resource,
				policy.conditions
			);
			if (isPolicyAuthorized) return true;
		}

		return false;
	}

	private evaluate(
		user: User<RoleType>,
		resource: Resource<ResourceType>,
		condition: Condition
	): boolean {
		if ('conditions' in condition) {
			return this.evaluateLogicalCondition(user, resource, condition);
		}

		if (!('value' in condition)) {
			return this.evaluateOwnershipCondition(user, resource, condition);
		}

		const key = condition.key;

		const resourceValue = resource.attributes[key];
		const userValue = user.attributes[key];

		if (resourceValue === undefined || userValue === undefined) {
			return false;
		}

		const resourceEval = this.evaluateAdvancedCondition(
			condition,
			resourceValue
		);
		const userEval = this.evaluateAdvancedCondition(condition, userValue);

		// i don't understand what logic should be used here
		// should we use && or ||
		// should we not evaluate conditions like clearance level for resources
		return resourceEval || userEval;
	}

	private evaluateLogicalCondition(
		user: User<RoleType>,
		resource: Resource<ResourceType>,
		logicalCondition: LogicalCondition
	) {
		switch (logicalCondition.operator) {
			case 'and':
				return logicalCondition.conditions.every((c) =>
					this.evaluate(user, resource, c)
				);
			case 'or':
				return logicalCondition.conditions.some((c) =>
					this.evaluate(user, resource, c)
				);
			case 'not':
				return !this.evaluate(user, resource, logicalCondition);
			default:
				throw new Error('Invalid logical condition');
		}
	}

	private evaluateOwnershipCondition(
		user: User<RoleType>,
		resource: Resource<ResourceType>,
		condition: OwnerCondition
	) {
		if (!resource.attributes[condition.key]) return false;

		return user.id === resource.attributes[condition.key];
	}

	private evaluateAdvancedCondition(
		condition: AdvancedCondition,
		value: unknown
	) {
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
	// private validatePolicies(policies: Policy<ResourceType>[]);
}

class InvalidOperandError extends Error {
	constructor(value: unknown, operator: string) {
		super(`Invalid value type: ${typeof value} for condition ${operator}`);
	}
}
