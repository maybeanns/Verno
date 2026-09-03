import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import * as util from 'util';

// Use execFile (not exec) to prevent shell injection via workspace paths
const execFile = util.promisify(childProcess.execFile);

/**
 * Represents a single parsed Conventional Commit entry.
 */
export interface CommitEntry {
  /** Short git commit hash (7 chars) */
  hash: string;
  /** Conventional commit type: feat, fix, chore, docs, refactor, test, perf, ci, etc. */
  type: string;
  /** Optional scope from the commit message, e.g. "auth" in "feat(auth): ..." */
  scope?: string;
  /** Cleaned commit subject (without type/scope prefix) */
  subject: string;
  /** Full commit body text */
  body: string;
  /** True if the commit includes a breaking change marker (! or BREAKING CHANGE:) */
  isBreaking: boolean;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
}

/**
 * A grouped changelog section, representing one version or the Unreleased block.
 */
export interface ChangelogSection {
  version: string;
  date: string;
  breaking: CommitEntry[];
  features: CommitEntry[];
  fixes: CommitEntry[];
  performance: CommitEntry[];
  refactors: CommitEntry[];
  docs: CommitEntry[];
  chores: CommitEntry[];
  ci: CommitEntry[];
  tests: CommitEntry[];
  other: CommitEntry[];
}

/**
 * ChangelogService — Phase 11 (DOC-02)
 *
 * Reads git log from the workspace repository, parses Conventional Commit
 * messages, groups them by type, and writes a formatted CHANGELOG.md.
 *
 * Security: uses execFile (not exec) to prevent shell injection.
 * Safety: preserves existing CHANGELOG.md content — new entries are prepended.
 */
export class ChangelogService {
  constructor(private logger: any) {}

  /**
   * Generate or update CHANGELOG.md from git history in the given workspace root.
   * Parses Conventional Commits and groups by version tags.
   * Existing CHANGELOG.md content is preserved and appended after the new entries.
   *
   * @param workspaceRoot - Absolute path to the git repository root
   * @param outputPath - Path to write CHANGELOG.md (defaults to workspaceRoot/CHANGELOG.md)
   * @returns Absolute path to the written CHANGELOG.md file
   * @throws Error if git log fails and produces no output
   */
  async generate(workspaceRoot: string, outputPath?: string): Promise<string> {
    const changelogPath = outputPath || path.join(workspaceRoot, 'CHANGELOG.md');

    // ── 1. Fetch git log ──────────────────────────────────────────────────
    const gitLogArgs = [
      'log',
      '--pretty=format:COMMIT_START%n%H|%ad|%s%n%b%nCOMMIT_END',
      '--date=short',
      '--no-merges',
    ];

    let gitOutput = '';
    try {
      const { stdout } = await execFile('git', gitLogArgs, {
        cwd: workspaceRoot,
        maxBuffer: 10 * 1024 * 1024,
      });
      gitOutput = stdout;
    } catch (err: any) {
      // execFile rejects on non-zero exit, but stdout may still contain useful data
      gitOutput = err.stdout || '';
      if (!gitOutput) {
        throw new Error(`git log failed: ${err.message}`);
      }
    }

    // ── 2. Fetch version tags ─────────────────────────────────────────────
    let tags: Array<{ tag: string; hash: string; date: string }> = [];
    try {
      const { stdout: tagOutput } = await execFile(
        'git',
        [
          'tag', '-l',
          '--sort=-version:refname',
          '--format=%(refname:short)|%(objectname:short)|%(creatordate:short)',
        ],
        { cwd: workspaceRoot }
      );
      tags = tagOutput
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const parts = line.split('|');
          return {
            tag: (parts[0] || '').trim(),
            hash: (parts[1] || '').trim(),
            date: (parts[2] || '').trim(),
          };
        })
        .filter(t => t.tag);
    } catch {
      // No tags — treat all commits as "Unreleased"
      this.logger.info('[ChangelogService] No git tags found — all commits will appear under Unreleased');
    }

    // ── 3. Parse, group, render ───────────────────────────────────────────
    const commits = this.parseCommits(gitOutput);
    this.logger.info(`[ChangelogService] Parsed ${commits.length} commit(s) from git log`);

    const sections = this.groupByVersion(commits, tags);
    const markdown = this.renderMarkdown(sections);

    // ── 4. Preserve existing CHANGELOG content (prepend new entries) ──────
    let existingContent = '';
    if (fs.existsSync(changelogPath)) {
      existingContent = fs.readFileSync(changelogPath, 'utf-8');
      // Strip the old header block to avoid duplication
      existingContent = existingContent
        .replace(/^# Changelog[\s\S]*?\n(?=##|$)/, '')
        .trim();
    }

    const finalContent = existingContent
      ? `${markdown}\n\n---\n\n${existingContent}`
      : markdown;

    fs.writeFileSync(changelogPath, finalContent, 'utf-8');
    this.logger.info(`[ChangelogService] CHANGELOG.md written to ${changelogPath}`);
    return changelogPath;
  }

  /**
   * Parse raw git log output into structured CommitEntry objects.
   * Recognises the Conventional Commits spec: type(scope)!: subject
   */
  private parseCommits(gitLog: string): CommitEntry[] {
    const commits: CommitEntry[] = [];
    // Conventional Commits: type(scope)!: subject  OR  type: subject
    const conventionalRegex = /^(\w+)(\([^)]+\))?(!)?:\s*(.+)$/;

    const rawCommits = gitLog.split('COMMIT_START\n').filter(Boolean);

    for (const raw of rawCommits) {
      const endIdx = raw.indexOf('\nCOMMIT_END');
      const block = endIdx >= 0 ? raw.substring(0, endIdx) : raw;
      const lines = block.split('\n');
      const firstLine = lines[0] || '';

      // Format: HASH|DATE|SUBJECT
      const pipeIdx = firstLine.indexOf('|');
      if (pipeIdx < 0) { continue; }
      const hash = firstLine.substring(0, pipeIdx).trim();
      const rest = firstLine.substring(pipeIdx + 1);
      const pipe2 = rest.indexOf('|');
      if (pipe2 < 0) { continue; }
      const date = rest.substring(0, pipe2).trim();
      const subject = rest.substring(pipe2 + 1).trim();
      const body = lines.slice(1).join('\n').replace('COMMIT_END', '').trim();

      if (!hash || !subject) { continue; }

      const match = conventionalRegex.exec(subject);
      if (!match) {
        commits.push({ hash, type: 'other', subject, body, isBreaking: false, date });
        continue;
      }

      const [, type, scopeRaw, bang] = match;
      const scope = scopeRaw ? scopeRaw.replace(/[()]/g, '') : undefined;
      const cleanSubject = match[4];
      const isBreaking = bang === '!' || body.toLowerCase().includes('breaking change:');

      commits.push({
        hash,
        type: type.toLowerCase(),
        scope,
        subject: cleanSubject,
        body,
        isBreaking,
        date,
      });
    }

    return commits;
  }

  /**
   * Group parsed commits into changelog sections by version tag.
   * All commits are placed in an "Unreleased" section; tag sections are listed
   * below as historical placeholders (future: map commits to tags by date).
   */
  private groupByVersion(
    commits: CommitEntry[],
    tags: Array<{ tag: string; hash: string; date: string }>
  ): ChangelogSection[] {
    const today = new Date().toISOString().split('T')[0];
    const unreleased = this.emptySection('Unreleased', today);

    for (const commit of commits) {
      this.bucketCommit(unreleased, commit);
    }

    const sections: ChangelogSection[] = [unreleased];

    // Append tag sections (up to 10 most recent tags)
    for (const tag of tags.slice(0, 10)) {
      sections.push(this.emptySection(tag.tag, tag.date || today));
    }

    return sections;
  }

  /** Route a single commit to the correct bucket within a section. */
  private bucketCommit(section: ChangelogSection, commit: CommitEntry): void {
    if (commit.isBreaking) { section.breaking.push(commit); return; }
    switch (commit.type) {
      case 'feat':     section.features.push(commit);    break;
      case 'fix':      section.fixes.push(commit);       break;
      case 'perf':     section.performance.push(commit); break;
      case 'refactor': section.refactors.push(commit);   break;
      case 'docs':     section.docs.push(commit);        break;
      case 'chore':    section.chores.push(commit);      break;
      case 'ci':       section.ci.push(commit);          break;
      case 'test':     section.tests.push(commit);       break;
      default:         section.other.push(commit);       break;
    }
  }

  /** Create an empty section with all bucket arrays initialised. */
  private emptySection(version: string, date: string): ChangelogSection {
    return {
      version, date,
      breaking: [], features: [], fixes: [], performance: [],
      refactors: [], docs: [], chores: [], ci: [], tests: [], other: [],
    };
  }

  /**
   * Render an array of changelog sections as formatted markdown.
   * Sections with no entries are omitted from the output.
   */
  private renderMarkdown(sections: ChangelogSection[]): string {
    const lines: string[] = [
      '# Changelog',
      '',
      'All notable changes to this project will be documented in this file.',
      'This file is auto-generated by `verno.generateChangelog` from Conventional Commits.',
      '',
    ];

    for (const section of sections) {
      const buckets = [
        section.breaking, section.features, section.fixes, section.performance,
        section.refactors, section.docs, section.chores, section.ci, section.tests, section.other,
      ];
      if (buckets.every(b => b.length === 0)) { continue; }

      lines.push(`## [${section.version}] — ${section.date}`, '');

      if (section.breaking.length > 0) {
        lines.push('### ⚠ Breaking Changes', '');
        section.breaking.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
      if (section.features.length > 0) {
        lines.push('### ✨ Features', '');
        section.features.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
      if (section.fixes.length > 0) {
        lines.push('### 🐛 Bug Fixes', '');
        section.fixes.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
      if (section.performance.length > 0) {
        lines.push('### ⚡ Performance', '');
        section.performance.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
      if (section.refactors.length > 0) {
        lines.push('### ♻️ Refactors', '');
        section.refactors.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
      if (section.docs.length > 0) {
        lines.push('### 📝 Documentation', '');
        section.docs.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
      if (section.chores.length > 0) {
        lines.push('### 🔧 Chores', '');
        section.chores.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
      if (section.ci.length > 0) {
        lines.push('### 🚀 CI/CD', '');
        section.ci.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
      if (section.tests.length > 0) {
        lines.push('### 🧪 Tests', '');
        section.tests.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
      if (section.other.length > 0) {
        lines.push('### 📦 Other', '');
        section.other.forEach(c => lines.push(this.formatEntry(c)));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /** Format a single commit as a markdown list entry. */
  private formatEntry(commit: CommitEntry): string {
    const scope = commit.scope ? `**${commit.scope}**: ` : '';
    const shortHash = commit.hash.substring(0, 7);
    return `- ${scope}${commit.subject} (\`${shortHash}\`)`;
  }
}
