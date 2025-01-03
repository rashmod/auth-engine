import type { Policy, Resource } from '@/policy-generator';
import type {
	Action,
	AdvancedCondition,
	Condition,
	DynamicKey,
	LogicalCondition,
	MembershipCondition,
	OwnershipCondition,
	User,
} from '@/schema';
import { membershipOperator, ownershipOperator } from '@/schema';

export class Auth<T extends readonly [string, ...string[]]> {
	constructor(private readonly policies: Policy<T>[]) {}

	isAuthorized(user: User, resource: Resource<T>, action: Action) {
		const relevantPolicies = this.policies.filter((policy) => {
			return policy.resource === resource.type && policy.action === action;
		});

		for (const policy of relevantPolicies) {
			const isAuthorized = this.abac(user, resource, policy);
			if (isAuthorized) return true;
		}

		return false;
	}

	private abac(user: User, resource: Resource<T>, policy: Policy<T>) {
		if (!policy.conditions) return true;

		return this.evaluate(user, resource, policy.conditions);
	}

	private evaluate(
		user: User,
		resource: Resource<T>,
		condition: Condition
	): boolean {
		if ('conditions' in condition) {
			return this.evaluateLogicalCondition(user, resource, condition);
		}

		if (condition.operator === ownershipOperator.value) {
			return this.evaluateOwnershipCondition(user, resource, condition);
		}

		if (condition.operator === membershipOperator.value) {
			return this.evaluateMembershipCondition(user, resource, condition);
		}

		return this.handleComparisonForAdvancedCondition(user, resource, condition);
	}

	private evaluateLogicalCondition(
		user: User,
		resource: Resource<T>,
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
		resource: Resource<T>,
		condition: OwnershipCondition
	) {
		const ownerValue = user.attributes[condition.ownerKey];
		const resourceValue = resource.attributes[condition.resourceKey];

		if (ownerValue === undefined || resourceValue === undefined) {
			return false;
		}
		if (Array.isArray(ownerValue)) {
			throw new InvalidOperandError(ownerValue, ownershipOperator.value);
		}
		if (Array.isArray(resourceValue)) {
			throw new InvalidOperandError(resourceValue, ownershipOperator.value);
		}

		return ownerValue === resourceValue;
	}

	private evaluateMembershipCondition(
		user: User,
		resource: Resource<T>,
		membershipCondition: MembershipCondition
	) {
		const referenceKey = this.getDynamicKey(membershipCondition.referenceKey);
		const collectionKey = this.getDynamicKey(membershipCondition.collectionKey);

		const referenceValue =
			membershipCondition.collectionSource === 'resource'
				? user.attributes[referenceKey]
				: resource.attributes[referenceKey];

		const collectionValue =
			membershipCondition.collectionSource === 'resource'
				? resource.attributes[collectionKey]
				: user.attributes[collectionKey];

		if (collectionValue === undefined || referenceValue === undefined) {
			return false;
		}

		if (!Array.isArray(collectionValue)) {
			throw new InvalidOperandError(collectionValue, membershipOperator.value);
		}
		if (Array.isArray(referenceValue)) {
			throw new InvalidOperandError(referenceValue, membershipOperator.value);
		}

		return collectionValue.find((v) => v === referenceValue) !== undefined;
	}

	private evaluateAdvancedCondition<T extends string | number | boolean>(
		condition: AdvancedCondition,
		value: T
	) {
		function isPrimitive(value: T) {
			return (
				typeof value === 'string' ||
				typeof value === 'number' ||
				typeof value === 'boolean'
			);
		}

		function validateValue(check: boolean, operator: string, value: T) {
			if (!check) {
				throw new InvalidOperandError(value, operator);
			}
		}

		switch (condition.operator) {
			case 'eq':
			case 'ne': {
				validateValue(isPrimitive(value), condition.operator, value);
				const result =
					condition.operator === 'eq'
						? value === condition.referenceValue
						: value !== condition.referenceValue;

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
						return val > condition.referenceValue;
					case 'gte':
						return val >= condition.referenceValue;
					case 'lt':
						return val < condition.referenceValue;
					case 'lte':
						return val <= condition.referenceValue;
				}
			}

			case 'in':
			case 'nin': {
				validateValue(
					(typeof value === 'string' || typeof value === 'number') &&
						condition.referenceValue.some(
							(item) => typeof item === typeof value
						),
					condition.operator,
					value
				);
				const includes =
					condition.referenceValue.find((item) => item === value) !== undefined;
				const result = condition.operator === 'in' ? includes : !includes;

				return result;
			}
		}
	}

	private handleComparisonForAdvancedCondition(
		user: User,
		resource: Resource<T>,
		advancedCondition: AdvancedCondition
	) {
		const key = advancedCondition.attributeKey;

		const resourceValue = resource.attributes[key];
		const userValue = user.attributes[key];

		if (advancedCondition.compareSource === 'user' && userValue) {
			if (Array.isArray(userValue)) {
				throw new InvalidOperandError(userValue, advancedCondition.operator);
			}
			return this.evaluateAdvancedCondition(advancedCondition, userValue);
		}

		if (advancedCondition.compareSource === 'resource' && resourceValue) {
			if (Array.isArray(resourceValue)) {
				throw new InvalidOperandError(
					resourceValue,
					advancedCondition.operator
				);
			}
			return this.evaluateAdvancedCondition(advancedCondition, resourceValue);
		}

		if (resourceValue === undefined || userValue === undefined) {
			return false;
		}

		if (Array.isArray(resourceValue)) {
			throw new InvalidOperandError(resourceValue, advancedCondition.operator);
		}
		if (Array.isArray(userValue)) {
			throw new InvalidOperandError(userValue, advancedCondition.operator);
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
		return str.slice(1);
	}
}

class InvalidOperandError extends Error {
	constructor(value: unknown, operator: string) {
		super(`Invalid value type: ${typeof value} for condition ${operator}`);
	}
}
