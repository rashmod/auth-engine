import type { Policy, Resource } from '@/policy-generator';
import type {
	Action,
	AttributeCondition,
	Condition,
	DynamicKey,
	EntityKeyCondition,
	LogicalCondition,
	NumericOperators,
} from '@/schema';
import { collectionOperators, equalityOperators, numericOperators } from '@/schema';

export class Auth<T extends readonly [string, ...string[]]> {
	constructor(private readonly policies: Policy<T>[]) {}

	isAuthorized(subject: Resource<T>, resource: Resource<T>, action: Action, log = false) {
		this.log('subject', subject, log);
		this.log('resource', resource, log);
		this.log('action', action, log);

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

		if ('attributeKey' in condition) {
			this.log('Advanced Condition', condition, log);
			return this.handleComparisonForAdvancedCondition(subject, resource, condition, log);
		}

		this.log('Entity Key Condition', condition, log);
		return this.evaluateEntityKeyCondition(subject, resource, condition, log);
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

	private evaluateAdvancedCondition<T extends string | number | boolean>(
		condition: Extract<AttributeCondition, { attributeKey: string }>,
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

	private evaluateEntityKeyCondition(
		subject: Resource<T>,
		resource: Resource<T>,
		condition: EntityKeyCondition,
		log = false
	) {
		if ('collectionSource' in condition) {
			const targetKey = this.getDynamicKey(condition.targetKey);
			const collectionKey = this.getDynamicKey(condition.collectionKey);

			const targetValue =
				condition.collectionSource === 'subject'
					? resource.attributes[collectionKey]
					: subject.attributes[targetKey];
			const collectionValue =
				condition.collectionSource === 'subject'
					? subject.attributes[targetKey]
					: resource.attributes[collectionKey];

			this.log(
				'Entity Key Condition Values',
				{ targetKey, collectionKey, targetValue, collectionValue },
				log
			);

			if (collectionValue === undefined || targetValue === undefined) {
				return false;
			}

			if (Array.isArray(targetValue)) {
				throw new InvalidOperandError(targetValue, condition.operator);
			}

			if (!Array.isArray(collectionValue)) {
				throw new InvalidOperandError(collectionValue, condition.operator);
			}

			return this.evaluateAdvancedCondition(
				{
					operator: condition.operator,
					attributeKey: 'this-is-ignored',
					referenceValue: collectionValue,
				},
				targetValue,
				log
			);
		}

		const subjectKey = this.getDynamicKey(condition.subjectKey);
		const resourceKey = this.getDynamicKey(condition.resourceKey);

		const subjectValue = subject.attributes[subjectKey];
		const resourceValue = resource.attributes[resourceKey];

		this.log(
			'Entity Key Condition Values',
			{ subjectKey, resourceKey, subjectValue, resourceValue },
			log
		);

		if (resourceValue === undefined || subjectValue === undefined) {
			return false;
		}

		if (Array.isArray(subjectValue)) {
			throw new InvalidOperandError(subjectValue, condition.operator);
		}

		if (Array.isArray(resourceValue)) {
			const parsed = collectionOperators.safeParse(condition.operator);

			if (!parsed.success) {
				throw new InvalidOperandError(resourceValue, condition.operator);
			}

			const isTypeSame = resourceValue.every((item) => typeof item === typeof subjectValue);
			// TODO should it be an error or should we just return false
			if (!isTypeSame) {
				throw new InvalidOperandError(subjectValue, condition.operator);
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
				throw new InvalidOperandError(subjectValue, condition.operator);
			}

			const equalityParsed = equalityOperators.safeParse(condition.operator);
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

			const numericParsed = numericOperators.safeParse(condition.operator);
			if (numericParsed.success) {
				if (typeof subjectValue !== 'number') {
					throw new InvalidOperandError(subjectValue, condition.operator);
				}
				if (typeof resourceValue !== 'number') {
					throw new InvalidOperandError(resourceValue, condition.operator);
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

			throw new InvalidOperandError(subjectValue, condition.operator);
		}
	}

	private handleComparisonForAdvancedCondition(
		subject: Resource<T>,
		resource: Resource<T>,
		advancedCondition: AttributeCondition,
		log = false
	) {
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
			default:
				throw new Error(`Invalid numeric operator: ${operator}`);
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
