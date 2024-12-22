export default function RoleSelection({
	value,
	onChange,
}: {
	value: string[];
	onChange: (value: string) => void;
}) {
	return (
		<div>
			<div className="mb-2">Roles</div>
			<div className="mt-4 flex flex-wrap items-center gap-4">
				{roles.map((role) => (
					<div key={role}>
						<input
							type="checkbox"
							id={role}
							value={role}
							className="peer hidden"
							onChange={() => onChange(role)}
							checked={value.includes(role)}
						/>
						<label
							htmlFor={role}
							className="inline-flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600 peer-checked:border-blue-600 peer-checked:text-blue-600"
						>
							{role}
						</label>
					</div>
				))}
			</div>
		</div>
	);
}

export const roles = ['user', 'admin', 'super-admin'] as const;
