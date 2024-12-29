type Action = 'create' | 'read' | 'update' | 'delete';

type Attributes = Record<string, unknown>;

type Resource<Type = string, Attrs = Attributes> = {
	type: Type;
	attributes: Attrs;
};

type User<Role = string, Attrs = Attributes> = {
	id: string;
	roles: Role[];
	attributes: Attrs;
};

type Condition<User, Resource> = (user: User, resource: Resource) => boolean;

type Policy<Role, Res extends Resource> = {
	action: Action;
	role: Role;
	resource: Res['type'];
	conditions?: Condition<User<Role>, Res>;
};

class TypeRegistry {
	private roles = new Set<string>();
	private resourceTypes = new Map<string, Attributes>();

	registerRole<Role extends string>(role: Role) {
		this.roles.add(role);
		return role;
	}

	registerResource<Type extends string, Attrs extends Attributes>(
		type: Type,
		attributes: Attrs
	) {
		this.resourceTypes.set(type, attributes);
		return { type, attributes };
	}

	getResourceAttributes<Type extends string>(type: Type) {
		return this.resourceTypes.get(type);
	}

	validateRole(role: string) {
		return this.roles.has(role);
	}
}

const registry = new TypeRegistry();

const viewer = registry.registerRole('viewer');
const editor = registry.registerRole('editor');

const blogPost = registry.registerResource('blogPost', { ownerId: 'string' });
const comment = registry.registerResource('comment', {
	postId: 'string',
	flagged: 'boolean',
});

class Auth<Role extends string, ResourceType extends Resource> {
	private policies: Policy<Role, ResourceType>[] = [];

	constructor(role: Role[], resource: ResourceType[]) {}

	addPolicy(
		role: Role,
		action: Action,
		resourceType: ResourceType['type'],
		conditions?: Condition<User<Role>, ResourceType>
	) {
		if (!registry.validateRole(role)) {
			throw new Error(`Invalid role: ${role}`);
		}

		if (!registry.getResourceAttributes(resourceType)) {
			throw new Error(`Invalid resource type: ${resourceType}`);
		}

		this.policies.push({ role, action, resource: resourceType, conditions });
	}

	isAuthorized(
		user: User<Role>,
		resource: ResourceType,
		action: Action
	): boolean {
		return this.policies.some((policy) => {
			if (policy.role && !user.roles.includes(policy.role)) {
				return false;
			}

			if (policy.resource !== resource.type) {
				return false;
			}

			if (policy.action !== action) {
				return false;
			}

			if (policy.conditions && !policy.conditions(user, resource)) {
				return false;
			}

			return true;
		});
	}
}

const authEngine = new Auth([viewer, editor], [blogPost]);

authEngine.addPolicy(
	viewer,
	'read',
	'blogPost',
	(user, resource) => resource.attributes.ownerId === user.id
);

authEngine.addPolicy(editor, 'delete', 'comment');

const foo = 'foo';
