#!/usr/bin/env node
/**
 * An OTA must be published from a COMMITTED tree.
 *
 * `eas update` bundles the WORKING TREE, not HEAD. That is easy to know and easy
 * to forget, and the consequence is not a bad build you can discard — it is a
 * bundle on real devices that corresponds to no commit, so afterwards nobody can
 * say what shipped. A store build cannot do this: EAS uploads tracked files only.
 * Updates have no such floor, so this is it.
 *
 * This is not hypothetical. While the tablet redesign was in progress the tree
 * held a local flag that forced the unfinished Gilded composition ON for tablets
 * — the exact opposite of the gate that had just been released to fix it. An OTA
 * published in that minute would have pushed it to every tablet, along with
 * half-written layout code. It was caught by hand, which is not a control.
 *
 * Escape hatch for a genuine emergency, where shipping beats bookkeeping:
 *
 *   ALLOW_DIRTY_UPDATE=1 npm run update:production -- -m "..."
 *
 * It prints what is uncommitted, so the choice is at least made with the diff in
 * view rather than in ignorance.
 */
import { execFileSync } from 'node:child_process';

const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

let status;
try {
  status = git(['status', '--porcelain']);
} catch {
  // No git at all: refuse rather than guess. An update from an unknown tree is
  // precisely the thing this guard exists to prevent.
  console.error('✖ Not a git repository — cannot verify what would be published.');
  process.exit(1);
}

if (!status) {
  console.log(`✓ Working tree is clean (publishing ${git(['rev-parse', '--short', 'HEAD'])}).`);
  process.exit(0);
}

const dirty = status.split('\n').filter(Boolean);
console.error('✖ Refusing to publish an update from an uncommitted working tree.\n');
console.error('  `eas update` bundles the WORKING TREE, so these changes would go to');
console.error('  real devices, and the published bundle would match no commit:\n');
for (const line of dirty.slice(0, 40)) console.error(`    ${line}`);
if (dirty.length > 40) console.error(`    … and ${dirty.length - 40} more`);
console.error('\n  Commit (or stash) them, then publish. In a real emergency:');
console.error('    ALLOW_DIRTY_UPDATE=1 npm run update:production -- -m "..."');

if (process.env.ALLOW_DIRTY_UPDATE === '1') {
  console.error('\n⚠ ALLOW_DIRTY_UPDATE=1 — continuing anyway, with the above uncommitted.');
  process.exit(0);
}
process.exit(1);
