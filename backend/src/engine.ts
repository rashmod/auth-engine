import type { Policy, PolicyKey, Resource } from '@/policy-manager';
import type {
	Action,
	AttributeCondition,
	Condition,
	DynamicKey,
	EntityKeyCondition,
	LogicalCondition,
	NumericOperators,
} from '@/schema';
import {
	attributeConditionSchema,
	entityKeyCollectionConditionSchema,
	entityKeyConditionSchema,
	entityKeyPrimitiveConditionSchema,
	equalityOperators,
	logicalConditionSchema,
	numericOperators,
} from '@/schema';

export class AuthEngine<T extends readonly [string, ...string[]]> {
	constructor(
		private readonly policies: Map<PolicyKey<T>, Policy<T>[]>,
		private readonly options: { debug?: boolean; logger?: Logger<T> }
	) {}

	isAuthorized(subject: Resource<T>, resource: Resource<T>, action: Action, debug = false) {
		this.log('subject', subject, debug);
		this.log('resource', resource, debug);
		this.log('action', action, debug);

		const policyKey = this.getPolicyKey(resource, action);
		const relevantPolicies = this.policies.get(policyKey) || [];
		this.log('relevantPolicies', relevantPolicies, debug);

		for (const policy of relevantPolicies) {
			const isAuthorized = this.abac(subject, resource, policy, debug || this.options.debug);
			if (isAuthorized) return true;
		}

		return false;
	}

	private abac(subject: Resource<T>, resource: Resource<T>, policy: Policy<T>, debug = false) {
		if (!policy.conditions) {
			this.log('Policy has no conditions, granting access', true, debug);
			return true;
		}

		return this.evaluate(subject, resource, policy.conditions, debug);
	}

	private evaluate(
		subject: Resource<T>,
		resource: Resource<T>,
		condition: Condition,
		debug = false
	): boolean {
		const attributeCondition = attributeConditionSchema.safeParse(condition);
		if (attributeCondition.success) {
			this.log('Attribute Condition', condition, debug);
			return this.resolveAttributeCondition(subject, resource, attributeCondition.data, debug);
		}

		const entityKeyCondition = entityKeyConditionSchema.safeParse(condition);
		if (entityKeyCondition.success) {
			this.log('Entity Key Condition', condition, debug);
			return this.evaluateEntityKeyCondition(subject, resource, entityKeyCondition.data, debug);
		}

		const logicalCondition = logicalConditionSchema.safeParse(condition);
		if (logicalCondition.success) {
			this.log('Logical Condition', condition, debug);
			return this.evaluateLogicalCondition(subject, resource, logicalCondition.data, debug);
		}

		throw new Error('Why are you here? We should never get here. Wrong condition.');
	}

	private evaluateLogicalCondition(
		subject: Resource<T>,
		resource: Resource<T>,
		logicalCondition: LogicalCondition,
		debug = false
	) {
		switch (logicalCondition.operator) {
			case 'and': {
				const result = logicalCondition.conditions.every((c) =>
					this.evaluate(subject, resource, c, debug)
				);
				return result;
			}
			case 'or': {
				const result = logicalCondition.conditions.some((c) =>
					this.evaluate(subject, resource, c, debug)
				);
				return result;
			}
			case 'not': {
				const result = !this.evaluate(subject, resource, logicalCondition, debug);
				return result;
			}
			default:
				throw new Error('Why are you here? We should never get here. Wrong logical operator.');
		}
	}

	private evaluateAttributeCondition<T extends string | number | boolean>(
		condition: AttributeCondition,
		value: T
	) {
		function validateValue(check: boolean, operator: string, value: T, message = '') {
			if (!check) {
				throw new InvalidOperandError(value, operator, message);
			}
		}

		switch (condition.operator) {
			case 'eq':
			case 'ne': {
				validateValue(
					typeof value === typeof condition.referenceValue,
					condition.operator,
					value,
					'The values must be the same type, received different types.'
				);

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
				validateValue(
					typeof value === 'number',
					condition.operator,
					value,
					'The value must be a number.'
				);
				const val = value as number;
				return this.compareNumbers(condition.operator, val, condition.referenceValue);
			}

			case 'in':
			case 'nin': {
				validateValue(
					typeof value !== 'boolean' &&
						condition.referenceValue.find((item) => typeof item === typeof value) !== undefined,
					condition.operator,
					value,
					'The values must be the same type, received different types.'
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
		entityKeyCondition: EntityKeyCondition,
		debug = false
	) {
		const collectionCondition = entityKeyCollectionConditionSchema.safeParse(entityKeyCondition);

		if (collectionCondition.success) {
			const condition = collectionCondition.data;

			const collectionKey = this.getDynamicKey(condition.collectionKey);
			const targetKey = this.getDynamicKey(condition.targetKey);

			const collectionValue =
				condition.collectionSource === 'subject'
					? subject.attributes[targetKey]
					: resource.attributes[collectionKey];

			const targetValue =
				condition.collectionSource === 'subject'
					? resource.attributes[collectionKey]
					: subject.attributes[targetKey];

			this.log(
				'Entity Key Condition Values',
				{ targetKey, collectionKey, targetValue, collectionValue },
				debug
			);

			if (collectionValue === undefined || targetValue === undefined) {
				return false;
			}

			if (Array.isArray(targetValue)) {
				throw new InvalidOperandError(
					targetValue,
					entityKeyCondition.operator,
					'The target value must be a primitive, received an array'
				);
			}

			if (!Array.isArray(collectionValue)) {
				throw new InvalidOperandError(
					collectionValue,
					entityKeyCondition.operator,
					'The collection value must be an array, received a primitive'
				);
			}

			return this.evaluateAttributeCondition(
				{
					operator: condition.operator,
					attributeKey: 'this-is-ignored',
					referenceValue: collectionValue,
				},
				targetValue
			);
		}

		const primitiveCondition = entityKeyPrimitiveConditionSchema.safeParse(entityKeyCondition);

		if (primitiveCondition.success) {
			const condition = primitiveCondition.data;

			const subjectKey = this.getDynamicKey(condition.subjectKey);
			const resourceKey = this.getDynamicKey(condition.resourceKey);

			const subjectValue = subject.attributes[subjectKey];
			const resourceValue = resource.attributes[resourceKey];

			this.log(
				'Entity Key Condition Values',
				{ subjectKey, resourceKey, subjectValue, resourceValue },
				debug
			);

			if (resourceValue === undefined || subjectValue === undefined) {
				return false;
			}

			if (Array.isArray(subjectValue)) {
				throw new InvalidOperandError(
					subjectValue,
					entityKeyCondition.operator,
					'The subject value must be a primitive, received an array'
				);
			}

			if (Array.isArray(resourceValue)) {
				throw new InvalidOperandError(
					subjectValue,
					entityKeyCondition.operator,
					'The resource value must be a primitive, received an array'
				);
			}

			if (typeof subjectValue !== typeof resourceValue) {
				throw new InvalidOperandError(
					subjectValue,
					entityKeyCondition.operator,
					`The values must be the same type, received different types. Subject: ${typeof subjectValue}, Resource: ${typeof resourceValue}`
				);
			}

			const equalityParsed = equalityOperators.safeParse(entityKeyCondition.operator);
			if (equalityParsed.success) {
				return this.evaluateAttributeCondition(
					{
						operator: equalityParsed.data,
						referenceValue: resourceValue,
						attributeKey: 'this-is-ignored',
					},
					subjectValue
				);
			}

			const numericParsed = numericOperators.safeParse(entityKeyCondition.operator);
			if (numericParsed.success) {
				if (typeof subjectValue !== 'number') {
					throw new InvalidOperandError(
						subjectValue,
						entityKeyCondition.operator,
						'The subject value must be a number'
					);
				}
				if (typeof resourceValue !== 'number') {
					throw new InvalidOperandError(
						resourceValue,
						entityKeyCondition.operator,
						'The resource value must be a number'
					);
				}

				return this.evaluateAttributeCondition(
					{
						operator: numericParsed.data,
						referenceValue: resourceValue,
						attributeKey: 'this-is-ignored',
					},
					subjectValue
				);
			}
		}

		throw new Error('Why are you here? We should never get here. Idk how you got here.');
	}

	private resolveAttributeCondition(
		subject: Resource<T>,
		resource: Resource<T>,
		attributeCondition: AttributeCondition,
		debug = false
	) {
		const key = this.getDynamicKey(attributeCondition.attributeKey);

		const resourceValue = resource.attributes[key];
		const subjectValue = subject.attributes[key];

		this.log('Attribute Condition Values', { key, subjectValue, resourceValue }, debug);

		const isSubjectArray = Array.isArray(subjectValue);
		const isResourceArray = Array.isArray(resourceValue);

		if (attributeCondition.compareSource === 'subject' && subjectValue !== undefined) {
			if (isSubjectArray) {
				throw new InvalidOperandError(
					subjectValue,
					attributeCondition.operator,
					'The subject value must be a primitive, received an array'
				);
			}
			return this.evaluateAttributeCondition(attributeCondition, subjectValue);
		}

		if (attributeCondition.compareSource === 'resource' && resourceValue !== undefined) {
			if (isResourceArray) {
				throw new InvalidOperandError(
					resourceValue,
					attributeCondition.operator,
					'The resource value must be a primitive, received an array'
				);
			}
			return this.evaluateAttributeCondition(attributeCondition, resourceValue);
		}

		if (resourceValue === undefined || subjectValue === undefined) {
			return false;
		}

		if (isSubjectArray) {
			throw new InvalidOperandError(
				subjectValue,
				attributeCondition.operator,
				'The subject value must be a primitive, received an array'
			);
		}

		if (isResourceArray) {
			throw new InvalidOperandError(
				resourceValue,
				attributeCondition.operator,
				'The resource value must be a primitive, received an array'
			);
		}

		const resourceEval = this.evaluateAttributeCondition(attributeCondition, resourceValue);
		const subjectEval = this.evaluateAttributeCondition(attributeCondition, subjectValue);

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
				throw new Error('Why are you here? We should never get here. Wrong numeric operator.');
		}
	}

	private getDynamicKey(str: DynamicKey) {
		return str.slice(1);
	}

	private getPolicyKey(resource: Resource<T>, action: Action): PolicyKey<T> {
		return `${resource.type}:${action}`;
	}

	private log(message: string, data: unknown, debug: boolean): void;
	private log(
		message: string,
		data: unknown,
		debug: boolean,
		logger: Logger<T>,
		args: Parameters<Logger<T>>[0]
	): void;
	private log(
		message: string,
		data: unknown,
		debug: boolean,
		logger?: Logger<T>,
		args?: Parameters<Logger<T>>[0]
	) {
		if (logger && args) {
			const { subject, action, resource, condition } = args;
			logger({ subject, condition, resource, action });
		}
		if (debug) console.log(message, JSON.stringify(data, null, 2));
	}
}

class InvalidOperandError extends Error {
	constructor(value: unknown, operator: string, message = '') {
		super(
			`Invalid value type: ${typeof value} for condition ${operator}\nvalue: ${JSON.stringify(value, null, 2)}\n${message}`
		);
	}
}

export type Logger<T extends readonly [string, ...string[]]> = (inputs: {
	subject?: Resource<T>;
	resource?: Resource<T>;
	action?: Action;
	condition?: Condition;
}) => void;
