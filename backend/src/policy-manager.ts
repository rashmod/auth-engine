import { z } from 'zod';

import { Action, Attributes, actions, attributeSchema, conditionSchema } from '@/schema';

export class PolicyManager<T extends readonly [string, ...string[]]> {
	private readonly resourceSchema: z.ZodSchema<Resource<T>>;
	private readonly policySchema: z.ZodSchema<Policy<T>>;
	private readonly policies: Map<PolicyKey<T>, Policy<T>[]> = new Map();

	constructor(private readonly resourcesTypes: T) {
		this.resourcesTypes = resourcesTypes;
		this.policySchema = this.createPolicySchema();
		this.resourceSchema = this.createResourceSchema();
	}

	addPolicy(policy: Policy<T>) {
		this.validatePolicy(policy);

		const policyKey: PolicyKey<T> = `${policy.resource}:${policy.action}`;

		if (!this.policies.has(policyKey)) {
			this.policies.set(policyKey, []);
		}
		this.policies.get(policyKey)!.push(policy);
	}

	addPolicies(policies: Policy<T>[]) {
		for (const policy of policies) {
			this.addPolicy(policy);
		}
	}

	getPolicies() {
		return this.policies;
	}

	createResource(resource: { id: string; type: T[number]; attributes: Attributes }) {
		return this.resourceSchema.parse(resource);
	}

	private validatePolicy(policy: Policy<T>) {
		this.policySchema.parse(policy);
	}

	private createPolicySchema() {
		return z
			.object({
				action: actions,
				resource: z.enum(this.resourcesTypes),
				conditions: z.optional(conditionSchema),
			})
			.strict();
	}

	private createResourceSchema() {
		return z
			.object({
				id: z.string(),
				type: z.enum(this.resourcesTypes),
				attributes: attributeSchema,
			})
			.strict();
	}
}

export type Policy<T extends readonly [string, ...string[]]> = z.infer<
	ReturnType<PolicyManager<T>['createPolicySchema']>
>;

export type PolicyKey<T extends readonly [string, ...string[]]> = `${T[number]}:${Action}`;

export type Resource<T extends readonly [string, ...string[]]> = z.infer<
	ReturnType<PolicyManager<T>['createResourceSchema']>
>;
