/**
 * Smoke test: run ChangelogService against Verno's own git history.
 * Usage: npx ts-node src/test/documentation/changelog.smoke.ts
 *
 * Validates that:
 * 1. ChangelogService can run git log against the Verno repo
 * 2. The output file contains required markdown structure
 * 3. No CHANGELOG.smoke.md is left behind after the test
 */
import * as path from 'path';
import * as fs from 'fs';
import { ChangelogService } from '../../services/documentation/ChangelogService';

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
};

const service = new ChangelogService(logger);
const workspaceRoot = path.resolve(__dirname, '../../../');
const outputPath = path.join(workspaceRoot, 'CHANGELOG.smoke.md');

(async () => {
  console.log('Running ChangelogService smoke test...');
  console.log(`Workspace root: ${workspaceRoot}`);

  let result: string;
  try {
    result = await service.generate(workspaceRoot, outputPath);
    console.log(`✓ generate() returned: ${result}`);
  } catch (err: any) {
    console.error(`✗ generate() threw: ${err.message}`);
    process.exit(1);
  }

  // Read and check output
  if (!fs.existsSync(result)) {
    console.error(`✗ Output file not found: ${result}`);
    process.exit(1);
  }

  const content = fs.readFileSync(result, 'utf-8');
  console.log(`✓ File size: ${content.length} bytes`);

  // Basic assertions
  if (!content.includes('# Changelog')) {
    console.error('✗ Missing "# Changelog" header');
    process.exit(1);
  }
  console.log('✓ Contains # Changelog header');

  if (!content.includes('## [')) {
    console.error('✗ Missing version section headers (## [...])');
    process.exit(1);
  }
  console.log('✓ Contains version section(s)');

  if (content.includes('undefined') || content.includes('null')) {
    console.warn('⚠ Output contains "undefined" or "null" — may indicate parsing issues');
  }

  // Clean up smoke output
  fs.unlinkSync(result);
  if (fs.existsSync(result)) {
    console.error('✗ Failed to clean up smoke test output');
    process.exit(1);
  }
  console.log('✓ Cleaned up smoke test output');

  console.log('\n✅ All smoke test assertions passed');
})().catch(err => {
  console.error('✗ Smoke test failed:', err.message);
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  process.exit(1);
});
