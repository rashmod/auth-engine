import { z } from 'zod';

import {
	Attributes,
	actions,
	attributeSchema,
	conditionSchema,
} from '@/schema';

export class PolicyGenerator<T extends readonly [string, ...string[]]> {
	private resourceSchema: z.ZodSchema<Resource<T>>;
	private readonly policySchema: z.ZodSchema<Policy<T>>;
	private readonly policies: Policy<T>[] = [];

	constructor(private readonly resources: T) {
		this.resources = resources;
		this.policySchema = this.createPolicy();
		this.resourceSchema = this.generateResouceSchema();
	}

	addPolicy(policy: Policy<T>) {
		this.validatePolicy(policy);
		this.policies.push(policy);
	}

	addPolicies(policies: Policy<T>[]) {
		for (const policy of policies) {
			this.addPolicy(policy);
		}
	}

	getPolicies() {
		return this.policies;
	}

	createResource(resource: {
		id: string;
		type: T[number];
		attributes: Attributes;
	}) {
		return this.resourceSchema.parse(resource);
	}

	private validatePolicy(policy: Policy<T>) {
		this.policySchema.parse(policy);
	}

	private createPolicy() {
		return z
			.object({
				action: actions,
				resource: z.enum(this.resources),
				conditions: z.optional(conditionSchema),
			})
			.strict();
	}

	private generateResouceSchema() {
		return z
			.object({
				id: z.string(),
				type: z.enum(this.resources),
				attributes: attributeSchema,
			})
			.strict();
	}
}

export type Policy<T extends readonly [string, ...string[]]> = z.infer<
	ReturnType<PolicyGenerator<T>['createPolicy']>
>;

export type Resource<T extends readonly [string, ...string[]]> = z.infer<
	ReturnType<PolicyGenerator<T>['generateResouceSchema']>
>;
