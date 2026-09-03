/**
 * Builds the extension VSIX from the monorepo.
 *
 * Two things make this harder than `vsce package`:
 *  1. npm workspaces hoists dependencies to the repo root, and npm keeps
 *     hoisting even when invoked from inside a workspace member — so a local
 *     production install inside apps/extension yields nothing.
 *  2. vsce refuses relative paths that escape the extension directory, and
 *     will otherwise try to walk the entire monorepo.
 *
 * So we copy the extension and the shared packages into a staging directory
 * outside the workspace, install production dependencies there (where no
 * workspace root exists to hoist to), package, and copy the .vsix back. The
 * working tree is never mutated.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, existsSync, readdirSync, copyFileSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const extSrc = join(root, 'apps', 'extension');

const run = (cmd, args, cwd) =>
    execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

console.log('[1/5] Building shared packages');
run('npm', ['run', 'build:packages'], root);

console.log('\n[2/5] Compiling the extension');
run('npm', ['run', 'compile', '-w', 'verno'], root);
if (!existsSync(join(extSrc, 'out', 'extension.js'))) {
    console.error('Compile produced no out/extension.js — aborting.');
    process.exit(1);
}

console.log('\n[3/5] Staging outside the workspace');
const stage = mkdtempSync(join(tmpdir(), 'verno-vsix-'));
const stageExt = join(stage, 'apps', 'extension');
mkdirSync(stageExt, { recursive: true });

// Only what the VSIX needs. node_modules is deliberately not copied — it is
// reinstalled clean in the staging tree.
for (const entry of ['package.json', '.vscodeignore', 'out', 'media', 'CHANGELOG.md']) {
    const from = join(extSrc, entry);
    if (existsSync(from)) cpSync(from, join(stageExt, entry), { recursive: true });
}
for (const doc of ['README.md', 'LICENSE']) {
    if (existsSync(join(root, doc))) copyFileSync(join(root, doc), join(stageExt, doc));
}
// Compiled tests have no place in the VSIX. .vscodeignore cannot express this:
// the `!out/**/*.js` negation needed for the rest of out/ re-includes them.
rmSync(join(stageExt, 'out', 'test'), { recursive: true, force: true });
// file:../../packages/* must resolve from the staged extension.
for (const pkg of ['agents', 'llm']) {
    const dest = join(stage, 'packages', pkg);
    cpSync(join(root, 'packages', pkg), dest, {
        recursive: true,
        filter: (src) => !src.includes('node_modules'),
    });
    // Their devDependencies (typescript) are irrelevant once dist/ is built, and
    // `npm list --production` — which vsce runs — reports them as missing.
    const manifestPath = join(dest, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    delete manifest.devDependencies;
    delete manifest.scripts;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

console.log('\n[4/5] Installing production dependencies in the staging tree');
// The shared packages need threading past two vsce constraints: `npm list
// --production` rejects file: deps installed with --install-links as "invalid",
// and the zip step cannot follow the symlinks a plain file: install creates.
// So install the registry deps alone, drop real directories in, and declare
// them by exact version — which npm list accepts and the zip step can read.
const stagedPkgPath = join(stageExt, 'package.json');
const stagedPkg = JSON.parse(readFileSync(stagedPkgPath, 'utf8'));
const sharedNames = Object.keys(stagedPkg.dependencies).filter((d) => d.startsWith('@verno/'));
for (const d of sharedNames) delete stagedPkg.dependencies[d];
writeFileSync(stagedPkgPath, JSON.stringify(stagedPkg, null, 2) + '\n');

run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], stageExt);
// npm can leave orphans (playwright-core arrives via a transitive optional
// install); vsce's `npm list` treats any extraneous package as a hard error.
run('npm', ['prune', '--omit=dev'], stageExt);

for (const pkg of ['agents', 'llm']) {
    const from = join(stage, 'packages', pkg);
    const dest = join(stageExt, 'node_modules', '@verno', pkg);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    cpSync(join(from, 'dist'), join(dest, 'dist'), { recursive: true });
    copyFileSync(join(from, 'package.json'), join(dest, 'package.json'));
    const version = JSON.parse(readFileSync(join(from, 'package.json'), 'utf8')).version;
    stagedPkg.dependencies[`@verno/${pkg}`] = version;
}
writeFileSync(stagedPkgPath, JSON.stringify(stagedPkg, null, 2) + '\n');

console.log('\n[5/5] Packaging');
run('npx', ['--yes', '@vscode/vsce', 'package', '--allow-missing-repository'], stageExt);

const vsix = readdirSync(stageExt).filter((f) => f.endsWith('.vsix'));
if (!vsix.length) {
    console.error('No .vsix was produced.');
    process.exit(1);
}
const distDir = join(root, 'dist');
mkdirSync(distDir, { recursive: true });
for (const f of vsix) copyFileSync(join(stageExt, f), join(distDir, f));
rmSync(stage, { recursive: true, force: true });

console.log(`\nPackaged: dist/${vsix.join(', ')}`);
