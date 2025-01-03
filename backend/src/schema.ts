import { z } from 'zod';

const primitive = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.string().array(),
	z.number().array(),
	z.boolean().array(),
]);

export const attributeSchema = z.record(primitive);
export type Attributes = z.infer<typeof attributeSchema>;

export const userSchema = z.object({
	id: z.string(),
	attributes: attributeSchema,
});
export type User = z.infer<typeof userSchema>;

export const logicalOperators = z.enum(['and', 'or', 'not']);
export const ownershipOperator = z.literal('owner');
export const membershipOperator = z.literal('contains');
export const comparators = z.enum([
	'eq',
	'ne',
	'gt',
	'gte',
	'lt',
	'lte',
	'in',
	'nin',
]);

export type OwnershipOperator = z.infer<typeof ownershipOperator>;
export type MembershipOperator = z.infer<typeof membershipOperator>;
export type LogicalOperator = z.infer<typeof logicalOperators>;
export type Comparator = z.infer<typeof comparators>;

export const actions = z.enum(['read', 'create', 'update', 'delete']);
export type Action = z.infer<typeof actions>;

export const compareSource = z.enum(['user', 'resource']);
export type CompareSource = z.infer<typeof compareSource>;

export const advancedConditionSchema = z.union([
	z
		.object({
			attributeKey: z.string(),
			referenceValue: z.union([z.string(), z.number(), z.boolean()]),
			operator: z.enum(['eq', 'ne']),
			compareSource: compareSource.optional(),
		})
		.strict(),
	z
		.object({
			attributeKey: z.string(),
			referenceValue: z.number(),
			operator: z.enum(['gt', 'lt', 'gte', 'lte']),
			compareSource: compareSource.optional(),
		})
		.strict(),
	z
		.object({
			attributeKey: z.string(),
			referenceValue: z.union([z.string().array(), z.number().array()]), // add other types
			operator: z.enum(['in', 'nin']),
			compareSource: compareSource.optional(),
		})
		.strict(),
]);
export type AdvancedCondition = z.infer<typeof advancedConditionSchema>;

export const ownershipConditionSchema = z
	.object({
		operator: ownershipOperator,
		ownerKey: z.string(), // key in user
		resourceKey: z.string(), // key in resource
	})
	.strict();
export type OwnershipCondition = z.infer<typeof ownershipConditionSchema>;

export const dynamicKey = z.string().min(2).regex(/^\$.+/);
export type DynamicKey = z.infer<typeof dynamicKey>;
export const membershipConditionSchema = z
	.object({
		operator: membershipOperator,
		collectionKey: dynamicKey, // key of collection
		referenceKey: dynamicKey, // key of value to check
		collectionSource: compareSource,
	})
	.strict();
export type MembershipCondition = z.infer<typeof membershipConditionSchema>;

export const conditionWithoutLogicSchema = z.union([
	advancedConditionSchema,
	ownershipConditionSchema,
	membershipConditionSchema,
]);
export type Condition =
	| z.infer<typeof conditionWithoutLogicSchema>
	| { operator: 'and' | 'or'; conditions: Condition[] }
	| { operator: 'not'; conditions: Condition };

export const logicalConditionSchema: z.ZodType<Condition> = z.union([
	z
		.object({
			operator: z.enum(['and', 'or']),
			conditions: z.array(z.lazy(() => conditionSchema)),
		})
		.strict(),
	z
		.object({
			operator: z.enum(['not']),
			conditions: z.lazy(() => conditionSchema),
		})
		.strict(),
]);
export type LogicalCondition = z.infer<typeof logicalConditionSchema>;

export const conditionSchema = z.union([
	conditionWithoutLogicSchema,
	logicalConditionSchema,
]);
