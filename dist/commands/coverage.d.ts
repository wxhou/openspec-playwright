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
}): Promise<void>;
export declare function analyzeChange(name: string, projectRoot: string, testsDir: string, changesDir: string, _allTestFiles: string[]): CoverageChange;
export declare function computeOverall(changes: CoverageChange[], orphanedTests: string[], recommendations: string[]): CoverageReport;
export declare function parseScenarios(filePath: string): Scenario[];
export declare function parseTestCases(filePath: string): TestCase[];
export declare function extractKeywords(name: string): string[];
export declare function collectSpecFiles(dir: string, collected?: string[]): string[];
export {};
