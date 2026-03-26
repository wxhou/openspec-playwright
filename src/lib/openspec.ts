import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export interface NativeVerifyResult {
  passed: boolean;
  details: string;
  issues: string[];
}

/**
 * Run OpenSpec native verify - checks implementation against artifacts
 */
export async function runNativeVerify(change: string, projectRoot: string): Promise<NativeVerifyResult> {
  const changeDir = join(projectRoot, 'openspec', 'changes', change);
  const issues: string[] = [];

  // Check if change exists
  if (!existsSync(changeDir)) {
    return {
      passed: false,
      details: `Change "${change}" not found`,
      issues: [`No change directory at ${changeDir}`],
    };
  }

  // Check required artifacts
  const requiredArtifacts = ['proposal.md', 'specs', 'design.md', 'tasks.md'];
  for (const artifact of requiredArtifacts) {
    const artifactPath = join(changeDir, artifact);
    if (!existsSync(artifactPath)) {
      issues.push(`Missing artifact: ${artifact}`);
    }
  }

  // Check specs directory
  const specsDir = join(changeDir, 'specs');
  if (existsSync(specsDir)) {
    const specFiles = readdirSync(specsDir).filter((f: string) => f.endsWith('.md'));
    if (specFiles.length === 0) {
      issues.push('No spec files found in specs/');
    } else {
      console.log(chalk.gray(`  Found ${specFiles.length} spec file(s): ${specFiles.join(', ')}`));
    }
  }

  // Check if tasks.md has completed items
  const tasksPath = join(changeDir, 'tasks.md');
  if (existsSync(tasksPath)) {
    const tasks = readFileSync(tasksPath, 'utf-8');
    const totalTasks = (tasks.match(/^\s*[-*]\s+/gm) || []).length;
    const doneTasks = (tasks.match(/^\s*[-*]\s+\[x\]\s+/gim) || []).length;
    console.log(chalk.gray(`  Tasks: ${doneTasks}/${totalTasks} completed`));
    if (doneTasks < totalTasks) {
      issues.push(`${totalTasks - doneTasks} task(s) not completed`);
    }
  }

  const passed = issues.length === 0;
  return {
    passed,
    details: passed ? 'All artifacts present and tasks completed' : `Found ${issues.length} issue(s)`,
    issues,
  };
}

/**
 * Read OpenSpec specs for a change
 */
export function readOpenSpecSpecs(change: string, projectRoot: string): { files: string[]; content: string } {
  const specsDir = join(projectRoot, 'openspec', 'changes', change, 'specs');
  if (!existsSync(specsDir)) {
    return { files: [], content: '' };
  }

  const files = readdirSync(specsDir).filter((f: string) => f.endsWith('.md'));
  const content = files
    .map((f: string) => {
      const path = join(specsDir, f);
      return `## ${f}\n\n${readFileSync(path, 'utf-8')}`;
    })
    .join('\n\n');

  return { files, content };
}

