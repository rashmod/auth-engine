import { z } from 'zod';

const primitive = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.string().array(),
	z.number().array(),
]);

export const attributeSchema = z.record(primitive);

export const logicalOperators = z.enum(['and', 'or', 'not']);
export const comparators = z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin']);

export const equalityOperators = comparators.extract(['eq', 'ne']);
export const numericOperators = comparators.extract(['gt', 'gte', 'lt', 'lte']);
export const collectionOperators = comparators.extract(['in', 'nin']);

export const actions = z.enum(['read', 'create', 'update', 'delete']);

export const compareSource = z.enum(['subject', 'resource']);

export const dynamicKey = z.string().min(2).regex(/^\$.+/);

export const equalityConditionSchema = z
	.object({
		attributeKey: dynamicKey,
		referenceValue: z.union([z.string(), z.number(), z.boolean()]),
		operator: comparators.extract(['eq', 'ne']),
		compareSource: compareSource.optional(),
	})
	.strict();

export const numericConditionSchema = z
	.object({
		attributeKey: dynamicKey,
		referenceValue: z.number(),
		operator: comparators.extract(['gt', 'lt', 'gte', 'lte']),
		compareSource: compareSource.optional(),
	})
	.strict();

export const collectionConditionSchema = z
	.object({
		attributeKey: dynamicKey,
		referenceValue: z.union([z.string().array(), z.number().array()]), // add other types
		operator: comparators.extract(['in', 'nin']),
		compareSource: compareSource.optional(),
	})
	.strict();

export const entityKeyPrimitiveConditionSchema = z
	.object({
		subjectKey: dynamicKey,
		resourceKey: dynamicKey,
		operator: comparators.extract(['eq', 'ne', 'gt', 'lt', 'gte', 'lte']),
	})
	.strict();
export const entityKeyCollectionConditionSchema = z
	.object({
		targetKey: dynamicKey,
		collectionKey: dynamicKey,
		operator: comparators.extract(['in', 'nin']),
		collectionSource: compareSource,
	})
	.strict();

export const entityKeyConditionSchema = z.union([
	entityKeyPrimitiveConditionSchema,
	entityKeyCollectionConditionSchema,
]);

export const attributeConditionSchema = z.union([
	equalityConditionSchema,
	numericConditionSchema,
	collectionConditionSchema,
]);

export const baseConditionSchema = z.union([attributeConditionSchema, entityKeyConditionSchema]);

export const logicalConditionSchema: z.ZodType<Condition> = z.union([
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

export const conditionSchema = z.union([baseConditionSchema, logicalConditionSchema]);

export type Attributes = z.infer<typeof attributeSchema>;

export type LogicalOperator = z.infer<typeof logicalOperators>;
export type Comparators = z.infer<typeof comparators>;
export type EqualityOperators = z.infer<typeof equalityOperators>;
export type NumericOperators = z.infer<typeof numericOperators>;
export type CollectionOperators = z.infer<typeof collectionOperators>;

export type Action = z.infer<typeof actions>;
export type CompareSource = z.infer<typeof compareSource>;
export type DynamicKey = z.infer<typeof dynamicKey>;

export type EntityKeyCondition = z.infer<typeof entityKeyConditionSchema>;
export type AttributeCondition = z.infer<typeof attributeConditionSchema>;
export type LogicalCondition = z.infer<typeof logicalConditionSchema>;

export type Condition =
	| z.infer<typeof baseConditionSchema>
	| {
			operator: Extract<LogicalOperator, 'and' | 'or'>;
			conditions: Condition[];
	  }
	| { operator: Extract<LogicalOperator, 'not'>; conditions: Condition };
