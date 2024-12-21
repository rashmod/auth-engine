import { useState } from 'react';

import { Button } from '@/components/ui/button';

function App() {
	const [user, setUser] = useState({
		id: 1,
		name: 'Leanne Graham',
		roles: ['user'],
	});

	return (
		<main className="container py-8">
			<div className="mx-auto mb-4 w-1/4">
				<h1 className="text-3xl font-bold">Current user</h1>
				<p>Id: {user.id}</p>
				<p>Name: {user.name}</p>
				<p>Roles: {user.roles.join(', ')}</p>
			</div>

			<div className="flex items-center gap-4">
				<div className="w-20">User</div>
				{users.map((user) => (
					<div>
						<input
							type="radio"
							id={user.id.toString()}
							name="hosting"
							value={user.id.toString()}
							className="peer hidden"
							onChange={() => setUser((prev) => ({ ...prev, id: user.id, name: user.name }))}
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

			<div className="mx-auto mt-12 grid w-1/2 grid-cols-2 gap-4">
				{todos.map((todo) => (
					<div key={todo.id} className="rounded-md border border-gray-300 p-4">
						<p>{todo.title}</p>
						<p>{todo.completed ? 'Completed' : 'Not completed'}</p>
						<p>Created by: {todo.createdBy}</p>
						<div className="mt-4 flex gap-2">
							<Button>View</Button>
							<Button>Edit</Button>
							<Button>Delete</Button>
						</div>
					</div>
				))}
			</div>
		</main>
	);
}

export default App;

const todos = [
	{ id: 1, title: 'Todo 1', completed: false, createdBy: 1 },
	{ id: 2, title: 'Todo 2', completed: true, createdBy: 1 },
	{ id: 3, title: 'Todo 3', completed: false, createdBy: 2 },
	{ id: 4, title: 'Todo 4', completed: true, createdBy: 2 },
	{ id: 5, title: 'Todo 5', completed: false, createdBy: 3 },
	{ id: 6, title: 'Todo 6', completed: true, createdBy: 3 },
];

const users = [
	{ id: 1, name: 'Leanne Graham' },
	{ id: 2, name: 'Ervin Howell' },
	{ id: 3, name: 'Clementine Bauch' },
	{ id: 4, name: 'Patricia Lebsack' },
	{ id: 5, name: 'Chelsey Dietrich' },
];
