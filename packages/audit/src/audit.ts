import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { parseProjectContract } from '@siteverb/contracts';
import { scanProjectSources } from './source-scan.js';
import type { AuditFinding, AuditProjectOptions, AuditReport, SourceTool } from './types.js';

function duplicateFindings(tools: readonly SourceTool[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const field of ['id', 'name'] as const) {
    const seen = new Map<string, SourceTool>();
    for (const tool of tools) {
      const value = tool[field];
      if (!value) continue;
      const previous = seen.get(value);
      if (previous) {
        if (
          field === 'name' &&
          previous.owner === 'declarative' &&
          tool.owner === 'declarative' &&
          previous.file !== tool.file
        ) {
          continue;
        }
        findings.push({
          code: field === 'id' ? 'duplicate-stable-id' : 'duplicate-wire-name',
          file: tool.file,
          line: tool.line,
          column: tool.column,
          message: `Duplicate source tool ${field} "${value}".`,
          severity: 'error',
        });
      } else {
        seen.set(value, tool);
      }
    }
  }
  return findings;
}

export async function auditProject(options: AuditProjectOptions): Promise<AuditReport> {
  const root = resolve(options.root);
  const contractPath = resolve(root, options.contractPath);
  const relativeContractPath = relative(root, contractPath);
  if (
    relativeContractPath === '..' ||
    relativeContractPath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(relativeContractPath)
  ) {
    throw new TypeError('The contract must be inside the audited project root.');
  }
  const contract = parseProjectContract(JSON.parse(await readFile(contractPath, 'utf8')));
  const source = await scanProjectSources(root);
  const findings = [
    ...source.findings.map((finding) =>
      options.strictExternal && finding.code === 'external-registration-runtime'
        ? { ...finding, severity: 'error' as const }
        : finding,
    ),
    ...duplicateFindings(source.tools),
  ];
  const sourceById = new Map(
    source.tools.filter((tool) => tool.id).map((tool) => [tool.id as string, tool]),
  );
  for (const tool of contract.tools) {
    if (tool.registration === 'declarative') {
      const implementations = source.tools.filter(
        (candidate) => candidate.owner === 'declarative' && candidate.name === tool.name,
      );
      if (implementations.length === 0) {
        findings.push({
          code: 'contract-tool-missing-source',
          file: relativeContractPath,
          message: `Declarative contract tool "${tool.id}" has no matching form toolname.`,
          severity: 'error',
        });
      }
      for (const implementation of implementations) {
        if (implementation.autoSubmit && tool.risk !== 'read-only') {
          findings.push({
            code: 'unsafe-declarative-autosubmit',
            file: implementation.file,
            line: implementation.line,
            column: implementation.column,
            message: `State-changing declarative tool "${tool.id}" cannot use toolautosubmit.`,
            severity: 'error',
          });
        }
      }
      continue;
    }
    const implementation = sourceById.get(tool.id);
    if (!implementation) {
      findings.push({
        code: 'contract-tool-missing-source',
        file: relativeContractPath,
        message: `Contract tool "${tool.id}" has no static Siteverb definition in source.`,
        severity: 'error',
      });
    } else if (implementation.name !== tool.name) {
      findings.push({
        code: 'contract-name-mismatch',
        file: implementation.file,
        line: implementation.line,
        column: implementation.column,
        message: `Source name "${implementation.name ?? 'unknown'}" does not match contract name "${tool.name}" for "${tool.id}".`,
        severity: 'error',
      });
    }
  }

  const contractIds = new Set(contract.tools.map((tool) => tool.id));
  const contractDeclarativeNames = new Set(
    contract.tools.filter((tool) => tool.registration === 'declarative').map((tool) => tool.name),
  );
  for (const tool of source.tools) {
    if (tool.owner === 'siteverb' && tool.id && !contractIds.has(tool.id)) {
      findings.push({
        code: 'source-tool-missing-contract',
        file: tool.file,
        line: tool.line,
        column: tool.column,
        message: `Source tool "${tool.id}" is missing from the portable contract.`,
        severity: 'error',
      });
    }
    if (tool.owner === 'declarative' && tool.name && !contractDeclarativeNames.has(tool.name)) {
      findings.push({
        code: 'source-tool-missing-contract',
        file: tool.file,
        line: tool.line,
        column: tool.column,
        message: `Declarative source tool "${tool.name}" is missing from the portable contract.`,
        severity: 'error',
      });
    }
  }

  findings.sort((left, right) =>
    `${left.file}:${left.line ?? 0}:${left.code}`.localeCompare(
      `${right.file}:${right.line ?? 0}:${right.code}`,
    ),
  );
  return {
    version: 1,
    root: '.',
    contract: relativeContractPath,
    summary: {
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warning').length,
      filesScanned: source.filesScanned,
      sourceTools: source.tools.length,
      contractTools: contract.tools.length,
    },
    tools: source.tools,
    findings,
  };
}
