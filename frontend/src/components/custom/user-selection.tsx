export default function UserSelection({
	value,
	onChange,
}: {
	value: number;
	onChange: (value: (typeof users)[number]) => void;
}) {
	return (
		<div>
			<div className="mb-2">User</div>
			<div className="flex flex-wrap items-center gap-4">
				{users.map((user) => (
					<div key={user.id}>
						<input
							type="radio"
							id={user.id.toString()}
							name="hosting"
							value={user.id.toString()}
							className="peer hidden"
							onChange={() => onChange(user)}
							checked={user.id === value}
						/>
						<label
							htmlFor={user.id.toString()}
							className="inline-flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600 peer-checked:border-blue-600 peer-checked:text-blue-600"
						>
							{user.name}
						</label>
					</div>
				))}
			</div>
		</div>
	);
}

const users = [
	{ id: 1, name: 'Leanne Graham' },
	{ id: 2, name: 'Ervin Howell' },
	{ id: 3, name: 'Clementine Bauch' },
	{ id: 4, name: 'Patricia Lebsack' },
	{ id: 5, name: 'Chelsey Dietrich' },
];
