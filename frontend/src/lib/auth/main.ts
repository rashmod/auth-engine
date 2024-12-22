export type Action = 'read' | 'create' | 'update' | 'delete';
export type ResourceType = 'document' | 'file';
export type RoleType = 'user' | 'admin';

export type Role = {
	id: RoleType;
	permissions: Action[];
};

export type User = {
	id: string;
	roles: Role[];
	attributes: Record<string, unknown>;
};

export type Resource = {
	id: string;
	type: ResourceType;
	attributes: Record<string, unknown>;
};

export type Policy = {
	action: Action;
	resource: ResourceType;
	conditions: Partial<{
		[key in keyof User['attributes'] | keyof Resource['attributes']]: any;
	}>;
};

export class Auth {
	constructor(private readonly policies: Policy[]) {}

	rbac(user: User, action: Action) {}

	abac(resource: Resource, action: Action) {}

	isAuthorized(user: User, resource: Resource, action: Action) {
		return false;
	}
}
