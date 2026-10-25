interface CoverageChange {
    name: string;
    testCount: number;
    specScenarioCount: number;
    matchedScenarioCount: number;
    coveragePct: number;
    uncoveredScenarios: string[];
    coveredRoutes: string[];
    uncoveredRoutes: string[];
}
interface CoverageReport {
    changes: CoverageChange[];
    overallTestCount: number;
    overallScenarioCount: number;
    overallMatchedCount: number;
    overallCoveragePct: number;
    orphanedTests: string[];
    recommendations: string[];
}
interface Scenario {
    name: string;
    tags: string[];
    routes: string[];
    file: string;
}
interface TestCase {
    name: string;
    tags: string[];
    routes: string[];
    file: string;
}
export declare function coverage(changeName?: string, opts?: {
    json?: boolean;
    failUnder?: string;
    plan?: string;
}): Promise<number>;
/** Threshold decision for `--fail-under`. No flag means "never fail". */
export declare function coverageExitCode(overallPct: number, failUnder?: string): number;
/**
 * Collapse case, whitespace and punctuation so a scenario title matches the
 * way it was written into a plan — Chinese and English alike.
 */
export declare function normalizeTitle(text: string): string;
export declare function planCoverage(scenarios: string[], planText: string): {
    covered: string[];
    missing: string[];
};
/** Every `#### Scenario: <title>` across a change's delta spec files. */
export declare function extractScenarioTitles(specsDir: string): string[];
export declare function analyzeChange(name: string, projectRoot: string, testsDir: string, changesDir: string, _allTestFiles: string[]): CoverageChange;
export declare function computeOverall(changes: CoverageChange[], orphanedTests: string[], recommendations: string[]): CoverageReport;
export declare function parseScenarios(filePath: string): Scenario[];
export declare function parseTestCases(filePath: string): TestCase[];
export declare function extractKeywords(name: string): string[];
export declare function collectSpecFiles(dir: string, collected?: string[]): string[];
export {};
