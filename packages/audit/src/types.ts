export type AuditFindingCode =
  | 'contract-name-mismatch'
  | 'contract-tool-missing-source'
  | 'duplicate-stable-id'
  | 'duplicate-wire-name'
  | 'dynamic-origin-exposure'
  | 'dynamic-tool-metadata'
  | 'external-registration-runtime'
  | 'raw-native-registration'
  | 'source-parse-failed'
  | 'source-tool-missing-contract'
  | 'unsafe-declarative-autosubmit'
  | 'unsafe-origin-exposure';

export interface AuditFinding {
  readonly code: AuditFindingCode;
  readonly column?: number;
  readonly file: string;
  readonly line?: number;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface SourceTool {
  readonly autoSubmit?: boolean;
  readonly column: number;
  readonly file: string;
  readonly id?: string;
  readonly line: number;
  readonly name?: string;
  readonly owner: 'siteverb' | 'declarative';
}

export interface AuditReport {
  readonly version: 1;
  readonly root: string;
  readonly contract: string;
  readonly summary: {
    readonly errors: number;
    readonly warnings: number;
    readonly filesScanned: number;
    readonly sourceTools: number;
    readonly contractTools: number;
  };
  readonly tools: readonly SourceTool[];
  readonly findings: readonly AuditFinding[];
}

export interface AuditProjectOptions {
  readonly contractPath: string;
  readonly root: string;
  readonly strictExternal?: boolean;
}
