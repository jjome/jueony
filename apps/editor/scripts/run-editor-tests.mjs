import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// npm test -- tests/name.test.ts runs only that suite. A bare npm test retains
// the full release suite, including when invoked from the repository root.
const args = process.argv.slice(2);
if (!args.some(arg => arg.endsWith('.test.ts'))) args.push('tests/*.test.ts');
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...args], {
  cwd: resolve(import.meta.dirname, '..'),
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
