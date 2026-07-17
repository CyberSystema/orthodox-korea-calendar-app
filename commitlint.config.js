// Conventional Commits enforcement (feat:, fix:, chore:, docs:, refactor:, …).
// Your git history already follows this convention; commitlint keeps it consistent
// and unlocks auto-generated changelogs later. Runs from the .husky/commit-msg hook.
module.exports = { extends: ['@commitlint/config-conventional'] };
