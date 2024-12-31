const actions = ['read', 'create', 'update', 'delete'] as const;
const logicalOperators = ['and', 'or', 'not'] as const;
const comparators = [
	'eq',
	'ne',
	'gt',
	'gte',
	'lt',
	'lte',
	'in',
	'nin',
] as const;
const ownershipOperator = 'owner' as const;
const membershipOperator = 'contains' as const;

export type Action = (typeof actions)[number];
type LogicalOperator = (typeof logicalOperators)[number];
type Comparator = (typeof comparators)[number];
type OwnershipOperator = typeof ownershipOperator;
type MembershipOperator = typeof membershipOperator;

export type Attributes = Record<string, {}>;

export type Role<RoleType extends string> = {
	id: RoleType;
	permissions: Action[];
};

export type User = {
	id: string;
	attributes: Attributes;
};

export type Resource<ResourceType extends string> = {
	id: string;
	type: ResourceType;
	attributes: Attributes;
};

type Compare = 'user' | 'resource';

type OwnershipCondition = { key: string; operator: OwnershipOperator };

type DynamicKey = `$${string}`;
type MembershipCondition = {
	key: string;
	operator: MembershipOperator;
	value: DynamicKey;
	source: Compare;
};

type AdvancedCondition =
	| {
			key: string;
			value: string | number | boolean;
			operator: Extract<Comparator, 'eq' | 'ne'>;
			compare?: Compare;
	  }
	| {
			key: string;
			value: number;
			operator: Extract<Comparator, 'gt' | 'gte' | 'lt' | 'lte'>;
			compare?: Compare;
	  }
	| {
			key: string;
			value: unknown[];
			operator: Extract<Comparator, 'in' | 'nin'>;
			compare?: Compare;
	  };

type LogicalCondition =
	| {
			operator: Extract<LogicalOperator, 'and' | 'or'>;
			conditions: Condition[];
	  }
	| { operator: Extract<LogicalOperator, 'not'>; conditions: Condition };

type Condition =
	| AdvancedCondition
	| LogicalCondition
	| OwnershipCondition
	| MembershipCondition;

export type Policy<ResourceType extends string> = {
	action: Action;
	resource: ResourceType;
	conditions?: Condition;
};

export class Auth<ResourceType extends string> {
	constructor(private readonly policies: Policy<ResourceType>[]) {}

	isAuthorized(user: User, resource: Resource<ResourceType>, action: Action) {
		const result = this.abac(user, action, resource);
		if (result) return true;

		return false;
	}

	private abac(user: User, action: Action, resource: Resource<ResourceType>) {
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
		user: User,
		resource: Resource<ResourceType>,
		condition: Condition
	): boolean {
		if ('conditions' in condition) {
			return this.evaluateLogicalCondition(user, resource, condition);
		}

		if (condition.operator === ownershipOperator) {
			return this.evaluateOwnershipCondition(user, resource, condition);
		}

		if (condition.operator === membershipOperator) {
			return this.evaluateMembershipCondition(user, resource, condition);
		}

		return this.handleComparisonForAdvancedCondition(user, resource, condition);
	}

	private evaluateLogicalCondition(
		user: User,
		resource: Resource<ResourceType>,
		logicalCondition: LogicalCondition
	) {
		switch (logicalCondition.operator) {
			case 'and': {
				const result = logicalCondition.conditions.every((c) =>
					this.evaluate(user, resource, c)
				);
				return result;
			}
			case 'or': {
				const result = logicalCondition.conditions.some((c) =>
					this.evaluate(user, resource, c)
				);
				return result;
			}
			case 'not': {
				const result = !this.evaluate(user, resource, logicalCondition);
				return result;
			}
			default:
				throw new Error('Invalid logical condition');
		}
	}

	private evaluateOwnershipCondition(
		user: User,
		resource: Resource<ResourceType>,
		condition: OwnershipCondition
	) {
		if (!resource.attributes[condition.key]) {
			return false;
		}

		return user.id === resource.attributes[condition.key];
	}

	private evaluateMembershipCondition(
		user: User,
		resource: Resource<ResourceType>,
		membershipCondition: MembershipCondition
	) {
		const comparisonKey = this.getDynamicKey(membershipCondition.value);
		const targetKey = membershipCondition.key;

		const comparisonValue =
			membershipCondition.source === 'resource'
				? user.attributes[comparisonKey]
				: resource.attributes[targetKey];

		const targetValue =
			membershipCondition.source === 'resource'
				? resource.attributes[targetKey]
				: user.attributes[targetKey];

		if (targetValue === undefined || comparisonValue === undefined) {
			return false;
		}

		if (!Array.isArray(targetValue)) {
			throw new InvalidOperandError(targetValue, membershipOperator);
		}

		return targetValue.includes(comparisonValue);
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
				const result =
					condition.operator === 'eq'
						? val === condition.value
						: val !== condition.value;

				return result;
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
				validateValue(
					condition.value.some((item) => typeof item === typeof value),
					condition.operator,
					value
				);
				const result =
					condition.operator === 'in'
						? condition.value.includes(value)
						: !condition.value.includes(value);

				return result;
			}
		}
	}

	private handleComparisonForAdvancedCondition(
		user: User,
		resource: Resource<ResourceType>,
		advancedCondition: AdvancedCondition
	) {
		const key = advancedCondition.key;

		const resourceValue = resource.attributes[key];
		const userValue = user.attributes[key];

		if (advancedCondition.compare === 'user' && userValue) {
			return this.evaluateAdvancedCondition(advancedCondition, userValue);
		}

		if (advancedCondition.compare === 'resource' && resourceValue) {
			return this.evaluateAdvancedCondition(advancedCondition, resourceValue);
		}

		if (resourceValue === undefined || userValue === undefined) {
			return false;
		}

		const resourceEval = this.evaluateAdvancedCondition(
			advancedCondition,
			resourceValue
		);
		const userEval = this.evaluateAdvancedCondition(
			advancedCondition,
			userValue
		);

		return resourceEval && userEval;
	}

	private getDynamicKey(str: DynamicKey) {
		const key = str.slice(1);
		if (!key) {
			throw new Error(`Invalid dynamic key format: ${str}`);
		}
		return key;
	}

	// this can later be replaced with zod
	// private validatePolicies(policies: Policy<ResourceType>[]);
}

class InvalidOperandError extends Error {
	constructor(value: unknown, operator: string) {
		super(`Invalid value type: ${typeof value} for condition ${operator}`);
	}
}
