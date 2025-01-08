import { defineConfig } from 'tsup';

export default defineConfig({
	tsconfig: './tsconfig.json',
	entry: ['./src/index.ts'],
	format: ['cjs', 'esm'],
	dts: true,
	clean: true,
	shims: true,
	skipNodeModulesBundle: true,
});
