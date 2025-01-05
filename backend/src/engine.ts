import type { Policy, Resource } from '@/policy-generator';
import type {
	Action,
	AdvancedCondition,
	Condition,
	DynamicKey,
	LogicalCondition,
	MembershipCondition,
	NumericOperators,
	OwnershipCondition,
} from '@/schema';
import {
	collectionOperators,
	equalityOperators,
	membershipOperator,
	numericOperators,
	ownershipOperator,
} from '@/schema';

export class Auth<T extends readonly [string, ...string[]]> {
	constructor(private readonly policies: Policy<T>[]) {}

	isAuthorized(subject: Resource<T>, resource: Resource<T>, action: Action, log = false) {
		const relevantPolicies = this.policies.filter((policy) => {
			return policy.resource === resource.type && policy.action === action;
		});
		this.log('relevantPolicies', relevantPolicies, log);

		for (const policy of relevantPolicies) {
			const isAuthorized = this.abac(subject, resource, policy, log);
			if (isAuthorized) return true;
		}

		return false;
	}

	private abac(subject: Resource<T>, resource: Resource<T>, policy: Policy<T>, log = false) {
		if (!policy.conditions) {
			this.log('Policy has no conditions, granting access', true, log);
			return true;
		}

		return this.evaluate(subject, resource, policy.conditions, log);
	}

	private evaluate(
		subject: Resource<T>,
		resource: Resource<T>,
		condition: Condition,
		log = false
	): boolean {
		if ('conditions' in condition) {
			this.log('Logical Condition', condition, log);
			return this.evaluateLogicalCondition(subject, resource, condition, log);
		}

		if (condition.operator === ownershipOperator.value) {
			this.log('Ownership Condition', condition, log);
			return this.evaluateOwnershipCondition(subject, resource, condition, log);
		}

		if (condition.operator === membershipOperator.value) {
			this.log('Membership Condition', condition, log);
			return this.evaluateMembershipCondition(subject, resource, condition, log);
		}

		this.log('Advanced Condition', condition, log);
		return this.handleComparisonForAdvancedCondition(subject, resource, condition, log);
	}

	private evaluateLogicalCondition(
		subject: Resource<T>,
		resource: Resource<T>,
		logicalCondition: LogicalCondition,
		log = false
	) {
		switch (logicalCondition.operator) {
			case 'and': {
				const result = logicalCondition.conditions.every((c) =>
					this.evaluate(subject, resource, c, log)
				);
				return result;
			}
			case 'or': {
				const result = logicalCondition.conditions.some((c) =>
					this.evaluate(subject, resource, c, log)
				);
				return result;
			}
			case 'not': {
				const result = !this.evaluate(subject, resource, logicalCondition, log);
				return result;
			}
			default:
				throw new Error('Invalid logical condition');
		}
	}

	private evaluateOwnershipCondition(
		subject: Resource<T>,
		resource: Resource<T>,
		condition: OwnershipCondition,
		log = false
	) {
		const ownerValue = subject.attributes[condition.ownerKey];
		const resourceValue = resource.attributes[condition.resourceKey];

		this.log('Ownership Values', { ownerValue, resourceValue }, log);

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
		subject: Resource<T>,
		resource: Resource<T>,
		membershipCondition: MembershipCondition,
		log = false
	) {
		const referenceKey = this.getDynamicKey(membershipCondition.referenceKey);
		const collectionKey = this.getDynamicKey(membershipCondition.collectionKey);

		const referenceValue =
			membershipCondition.collectionSource === 'resource'
				? subject.attributes[referenceKey]
				: resource.attributes[referenceKey];

		const collectionValue =
			membershipCondition.collectionSource === 'resource'
				? resource.attributes[collectionKey]
				: subject.attributes[collectionKey];

		this.log('Membership Values', { referenceValue, collectionValue }, log);

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
		condition: Extract<AdvancedCondition, { attributeKey: string }>,
		value: T,
		log = false
	) {
		function isPrimitive(value: T) {
			return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
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
				return this.compareNumbers(condition.operator, val, condition.referenceValue);
			}

			case 'in':
			case 'nin': {
				validateValue(
					typeof value !== 'boolean' &&
						condition.referenceValue.some((item) => typeof item === typeof value),
					condition.operator,
					value
				);
				const includes = condition.referenceValue.find((item) => item === value) !== undefined;
				const result = condition.operator === 'in' ? includes : !includes;

				return result;
			}
		}
	}

	private handleComparisonForAdvancedCondition(
		subject: Resource<T>,
		resource: Resource<T>,
		advancedCondition: AdvancedCondition,
		log = false
	) {
		if ('attributeKey' in advancedCondition) {
			const key = this.getDynamicKey(advancedCondition.attributeKey);

			const resourceValue = resource.attributes[key];
			const subjectValue = subject.attributes[key];

			this.log('Advanced Condition Values', { subjectValue, resourceValue }, log);

			if (advancedCondition.compareSource === 'subject' && subjectValue) {
				if (Array.isArray(subjectValue)) {
					throw new InvalidOperandError(subjectValue, advancedCondition.operator);
				}
				return this.evaluateAdvancedCondition(advancedCondition, subjectValue, log);
			}

			if (advancedCondition.compareSource === 'resource' && resourceValue) {
				if (Array.isArray(resourceValue)) {
					throw new InvalidOperandError(resourceValue, advancedCondition.operator);
				}
				return this.evaluateAdvancedCondition(advancedCondition, resourceValue);
			}

			if (resourceValue === undefined || subjectValue === undefined) {
				return false;
			}

			if (Array.isArray(resourceValue)) {
				throw new InvalidOperandError(resourceValue, advancedCondition.operator);
			}
			if (Array.isArray(subjectValue)) {
				throw new InvalidOperandError(subjectValue, advancedCondition.operator);
			}

			const resourceEval = this.evaluateAdvancedCondition(advancedCondition, resourceValue);
			const subjectEval = this.evaluateAdvancedCondition(advancedCondition, subjectValue);

			return resourceEval && subjectEval;
		}

		const subjectKey = this.getDynamicKey(advancedCondition.subjectKey);
		const resourceKey = this.getDynamicKey(advancedCondition.resourceKey);

		const subjectValue = subject.attributes[subjectKey];
		const resourceValue = resource.attributes[resourceKey];

		if (resourceValue === undefined || subjectValue === undefined) {
			return false;
		}

		if (Array.isArray(subjectValue)) {
			throw new InvalidOperandError(subjectValue, advancedCondition.operator);
		}

		if (Array.isArray(resourceValue)) {
			const parsed = collectionOperators.safeParse(advancedCondition.operator);

			if (!parsed.success) {
				throw new InvalidOperandError(resourceValue, advancedCondition.operator);
			}

			const isTypeSame = resourceValue.every((item) => typeof item === typeof subjectValue);
			// TODO should it be an error or should we just return false
			if (!isTypeSame) {
				throw new InvalidOperandError(subjectValue, advancedCondition.operator);
			}

			return this.evaluateAdvancedCondition(
				{
					operator: parsed.data,
					referenceValue: resourceValue,
					attributeKey: 'this-is-a-dummy-value',
				},
				subjectValue,
				log
			);
		} else {
			if (typeof subjectValue !== typeof resourceValue) {
				throw new InvalidOperandError(subjectValue, advancedCondition.operator);
			}

			const equalityParsed = equalityOperators.safeParse(advancedCondition.operator);
			if (equalityParsed.success) {
				return this.evaluateAdvancedCondition(
					{
						operator: equalityParsed.data,
						referenceValue: resourceValue,
						attributeKey: 'this-is-a-dummy-value',
					},
					subjectValue
				);
			}

			const numericParsed = numericOperators.safeParse(advancedCondition.operator);
			if (numericParsed.success) {
				if (typeof subjectValue !== 'number') {
					throw new InvalidOperandError(subjectValue, advancedCondition.operator);
				}
				if (typeof resourceValue !== 'number') {
					throw new InvalidOperandError(resourceValue, advancedCondition.operator);
				}

				return this.evaluateAdvancedCondition(
					{
						operator: numericParsed.data,
						referenceValue: resourceValue,
						attributeKey: 'this-is-a-dummy-value',
					},
					subjectValue
				);
			}

			throw new InvalidOperandError(subjectValue, advancedCondition.operator);
		}
	}

	private compareNumbers(operator: NumericOperators, left: number, right: number) {
		switch (operator) {
			case 'gt':
				return left > right;
			case 'gte':
				return left >= right;
			case 'lt':
				return left < right;
			case 'lte':
				return left <= right;
		}
	}

	private getDynamicKey(str: DynamicKey) {
		return str.slice(1);
	}

	private log(message: string, data: unknown, log: boolean) {
		if (log) console.log(message, JSON.stringify(data, null, 2));
	}
}

class InvalidOperandError extends Error {
	constructor(value: unknown, operator: string, message?: string) {
		super(`Invalid value type: ${typeof value} for condition ${operator}\n${message}`);
	}
}
