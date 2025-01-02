import { z } from 'zod';

import { actions, conditionSchema } from './schema';

export class PolicyGenerator<T extends readonly [string, ...string[]]> {
	private readonly policySchema: z.ZodSchema<Policy<T>>;
	private readonly policies: Policy<T>[] = [];

	constructor(private readonly resources: T) {
		this.resources = resources;
		this.policySchema = this.createPolicy();
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

	private validatePolicy(policy: Policy<T>) {
		this.policySchema.parse(policy);
	}

	private createPolicy() {
		const resourceSchema = z.enum(this.resources);

		return z
			.object({
				action: actions,
				resource: resourceSchema,
				conditions: z.optional(conditionSchema),
			})
			.strict();
	}
}

export type Policy<T extends readonly [string, ...string[]]> = z.infer<
	ReturnType<PolicyGenerator<T>['createPolicy']>
>;
