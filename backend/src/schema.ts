import { z } from 'zod';

const primitive = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.string().array(),
	z.number().array(),
	// z.boolean().array(),
]);

export const attributeSchema = z.record(primitive);
export type Attributes = z.infer<typeof attributeSchema>;

const logicalOperators = z.enum(['and', 'or', 'not']);
export const membershipOperator = z.literal('contains');
const comparators = z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin']);

type LogicalOperator = z.infer<typeof logicalOperators>;

export const equalityOperators = comparators.extract(['eq', 'ne']);
export const numericOperators = comparators.extract(['gt', 'gte', 'lt', 'lte']);
export const collectionOperators = comparators.extract(['in', 'nin']);

export type NumericOperators = z.infer<typeof numericOperators>;

export const actions = z.enum(['read', 'create', 'update', 'delete']);
export type Action = z.infer<typeof actions>;

const compareSource = z.enum(['subject', 'resource']);

const dynamicKey = z.string().min(2).regex(/^\$.+/);
export type DynamicKey = z.infer<typeof dynamicKey>;
const membershipConditionSchema = z
	.object({
		operator: membershipOperator,
		collectionKey: dynamicKey, // key of collection
		referenceKey: dynamicKey, // key of value to check
		collectionSource: compareSource,
	})
	.strict();
export type MembershipCondition = z.infer<typeof membershipConditionSchema>;

const equalityConditionSchema = z
	.object({
		attributeKey: dynamicKey,
		referenceValue: z.union([z.string(), z.number(), z.boolean()]),
		operator: comparators.extract(['eq', 'ne']),
		compareSource: compareSource.optional(),
	})
	.strict();

const numericConditionSchema = z
	.object({
		attributeKey: dynamicKey,
		referenceValue: z.number(),
		operator: comparators.extract(['gt', 'lt', 'gte', 'lte']),
		compareSource: compareSource.optional(),
	})
	.strict();

const collectionConditionSchema = z
	.object({
		attributeKey: dynamicKey,
		referenceValue: z.union([z.string().array(), z.number().array()]), // add other types
		operator: comparators.extract(['in', 'nin']),
		compareSource: compareSource.optional(),
	})
	.strict();

const entityKeyConditionSchema = z
	.object({
		subjectKey: dynamicKey,
		resourceKey: dynamicKey,
		operator: comparators,
	})
	.strict();
export type EntityKeyCondition = z.infer<typeof entityKeyConditionSchema>;

const attributeConditionSchema = z.union([
	equalityConditionSchema,
	numericConditionSchema,
	collectionConditionSchema,
]);
export type AttributeCondition = z.infer<typeof attributeConditionSchema>;

const baseConditionSchema = z.union([
	attributeConditionSchema,
	entityKeyConditionSchema,
	membershipConditionSchema,
]);
export type Condition =
	| z.infer<typeof baseConditionSchema>
	| {
			operator: Extract<LogicalOperator, 'and' | 'or'>;
			conditions: Condition[];
	  }
	| { operator: Extract<LogicalOperator, 'not'>; conditions: Condition };

const logicalConditionSchema: z.ZodType<Condition> = z.union([
	z
		.object({
			operator: logicalOperators.extract(['and', 'or']),
			conditions: z.array(z.lazy(() => conditionSchema)),
		})
		.strict(),
	z
		.object({
			operator: logicalOperators.extract(['not']),
			conditions: z.lazy(() => conditionSchema),
		})
		.strict(),
]);
export type LogicalCondition = z.infer<typeof logicalConditionSchema>;

export const conditionSchema = z.union([baseConditionSchema, logicalConditionSchema]);
