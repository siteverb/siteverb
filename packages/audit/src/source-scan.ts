import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parse as parseJavaScript } from '@babel/parser';
import type { CallExpression, Node, ObjectExpression } from '@babel/types';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { AuditFinding, SourceTool } from './types.js';

const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.output',
  '.siteverb',
  '.svelte-kit',
  'coverage',
  'dist',
  'node_modules',
]);
const sourceExtension = /\.(?:[cm]?[jt]sx?)$/i;
const htmlExtension = /\.(?:html?|astro)$/i;
const componentExtension = /\.(?:vue|svelte)$/i;
const externalRuntimes = new Set([
  '@nekuda/webmcp-sdk',
  '@nekuda/webmcp',
  '@agentlane/webmcp',
  'usewebmcp',
  'use-webmcp-tool',
  '@mcp-b/react-webmcp',
  '@mcp-b/webmcp-ts-sdk',
]);

interface ScanResult {
  filesScanned: number;
  readonly findings: AuditFinding[];
  readonly tools: SourceTool[];
}

function location(node: Node, lineOffset = 0) {
  return {
    line: (node.loc?.start.line ?? 1) + lineOffset,
    column: (node.loc?.start.column ?? 0) + 1,
  };
}

function literalProperty(object: ObjectExpression, name: string): string | undefined {
  const property = object.properties.find(
    (candidate) =>
      candidate.type === 'ObjectProperty' &&
      ((candidate.key.type === 'Identifier' && candidate.key.name === name) ||
        (candidate.key.type === 'StringLiteral' && candidate.key.value === name)),
  );
  return property?.type === 'ObjectProperty' && property.value.type === 'StringLiteral'
    ? property.value.value
    : undefined;
}

function propertyValue(object: ObjectExpression, name: string): Node | undefined {
  const property = object.properties.find(
    (candidate) =>
      candidate.type === 'ObjectProperty' &&
      ((candidate.key.type === 'Identifier' && candidate.key.name === name) ||
        (candidate.key.type === 'StringLiteral' && candidate.key.value === name)),
  );
  return property?.type === 'ObjectProperty' ? property.value : undefined;
}

function callName(call: CallExpression): string | undefined {
  return call.callee.type === 'Identifier' ? call.callee.name : undefined;
}

function memberPath(node: Node | null | undefined): string | undefined {
  if (!node) return undefined;
  if (node.type === 'Identifier') return node.name;
  if (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression')
    return undefined;
  const object = memberPath(node.object);
  const property =
    !node.computed && node.property.type === 'Identifier'
      ? node.property.name
      : node.computed && node.property.type === 'StringLiteral'
        ? node.property.value
        : undefined;
  return object && property ? `${object}.${property}` : undefined;
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === 'object' && typeof entry.type === 'string') {
          walk(entry as Node, visit);
        }
      }
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      walk(value as Node, visit);
    }
  }
}

function isExternalRuntime(moduleName: string): boolean {
  return externalRuntimes.has(moduleName) || moduleName.startsWith('@mcp-b/');
}

function isExternalRuntimeReference(reference: string): boolean {
  return /(?:@mcp-b\/|@nekuda\/webmcp|@agentlane\/webmcp|usewebmcp|(?:^|\/)latch(?:@|\/|\.|$))/i.test(
    reference,
  );
}

function unwrapExpression(node: Node | null | undefined): Node | undefined {
  if (!node) return undefined;
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TypeCastExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'ParenthesizedExpression'
  ) {
    return unwrapExpression(node.expression);
  }
  return node;
}

function returnedExpression(node: Node): Node | undefined {
  if (node.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement') {
    return unwrapExpression(node.body);
  }
  const body =
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
      ? node.body
      : undefined;
  if (!body || body.type !== 'BlockStatement') return undefined;
  const returns = body.body.filter((statement) => statement.type === 'ReturnStatement');
  return returns.length === 1 ? unwrapExpression(returns[0]?.argument) : undefined;
}

function scanSource(path: string, root: string, sourceText: string, lineOffset = 0): ScanResult {
  const file = relative(root, path);
  const findings: AuditFinding[] = [];
  const tools: SourceTool[] = [];
  let source;
  try {
    source = parseJavaScript(sourceText, {
      sourceType: 'unambiguous',
      sourceFilename: path,
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'importAttributes'],
    });
  } catch {
    return {
      filesScanned: 1,
      findings: [
        {
          code: 'source-parse-failed',
          file,
          line: lineOffset + 1,
          message: 'Source could not be parsed for static WebMCP ownership coverage.',
          severity: 'warning',
        },
      ],
      tools,
    };
  }
  const toolDefinitionFunctions = new Set<string>();
  const siteverbClientFactories = new Set<string>();
  const siteverbNamespaces = new Set<string>();

  for (const statement of source.program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    const moduleName = statement.source.value;
    if (isExternalRuntime(moduleName)) {
      findings.push({
        code: 'external-registration-runtime',
        file,
        ...location(statement, lineOffset),
        message: `External WebMCP registration runtime "${moduleName}" requires an explicit coexistence or migration decision.`,
        severity: 'warning',
      });
    }
    if (moduleName !== '@siteverb/webmcp' && moduleName !== '@siteverb/react') continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportNamespaceSpecifier') {
        siteverbNamespaces.add(specifier.local.name);
        continue;
      }
      if (specifier.type !== 'ImportSpecifier') continue;
      const imported =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value;
      if (
        imported === 'defineTool' ||
        imported === 'useSiteverbTool' ||
        imported === 'useSiteverbTools'
      ) {
        toolDefinitionFunctions.add(specifier.local.name);
      }
      if (moduleName === '@siteverb/webmcp' && imported === 'createSiteverb') {
        siteverbClientFactories.add(specifier.local.name);
      }
    }
  }

  const staticValues = new Map<string, Node>();
  const staticFactories = new Map<string, Node>();
  const siteverbClients = new Set<string>();
  const addedToolObjects = new Set<ObjectExpression>();
  const isSiteverbFactory = (call: CallExpression): boolean => {
    const name = callName(call);
    const path = memberPath(call.callee);
    return Boolean(
      (name && siteverbClientFactories.has(name)) ||
      (path && [...siteverbNamespaces].some((namespace) => path === `${namespace}.createSiteverb`)),
    );
  };
  const isToolDefinitionCall = (call: CallExpression): boolean => {
    const name = callName(call);
    const path = memberPath(call.callee);
    return Boolean(
      (name && toolDefinitionFunctions.has(name)) ||
      (path &&
        [...siteverbNamespaces].some(
          (namespace) =>
            path === `${namespace}.defineTool` || path === `${namespace}.useSiteverbTool`,
        )),
    );
  };

  walk(source.program, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
      staticValues.set(node.id.name, node.init);
      if (node.init.type === 'CallExpression' && isSiteverbFactory(node.init)) {
        siteverbClients.add(node.id.name);
      }
      if (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression') {
        staticFactories.set(node.id.name, node.init);
      }
    }
    if (node.type === 'FunctionDeclaration' && node.id) {
      staticFactories.set(node.id.name, node);
    }
  });

  const resolveToolObjects = (
    node: Node | null | undefined,
    seen = new Set<string>(),
  ): ObjectExpression[] => {
    const value = unwrapExpression(node);
    if (!value) return [];
    if (value.type === 'ObjectExpression') return [value];
    if (value.type === 'ArrayExpression') {
      return value.elements.flatMap((element) =>
        element && element.type !== 'SpreadElement'
          ? resolveToolObjects(element, new Set(seen))
          : [],
      );
    }
    if (value.type === 'Identifier') {
      if (seen.has(value.name)) return [];
      seen.add(value.name);
      return resolveToolObjects(staticValues.get(value.name), seen);
    }
    if (value.type === 'CallExpression') {
      if (isToolDefinitionCall(value)) {
        const first = value.arguments[0];
        return first && first.type !== 'SpreadElement' ? resolveToolObjects(first, seen) : [];
      }
      const factoryName = callName(value);
      if (!factoryName || seen.has(factoryName)) return [];
      const factory = staticFactories.get(factoryName);
      if (!factory) return [];
      seen.add(factoryName);
      return resolveToolObjects(returnedExpression(factory), seen);
    }
    return [];
  };

  const addTool = (object: ObjectExpression): void => {
    if (addedToolObjects.has(object)) return;
    addedToolObjects.add(object);
    const position = location(object, lineOffset);
    const id = literalProperty(object, 'id');
    const wireName = literalProperty(object, 'name');
    tools.push({
      file,
      ...position,
      ...(id ? { id } : {}),
      ...(wireName ? { name: wireName } : {}),
      owner: 'siteverb',
    });
    if (!id || !wireName) {
      findings.push({
        code: 'dynamic-tool-metadata',
        file,
        ...position,
        message: 'Siteverb tool id and name must be static string literals for source coverage.',
        severity: 'warning',
      });
    }
  };

  const staticObject = (node: Node | null | undefined): ObjectExpression | undefined => {
    const value = unwrapExpression(node);
    if (!value) return undefined;
    if (value.type === 'ObjectExpression') return value;
    if (value.type !== 'Identifier') return undefined;
    const resolved = unwrapExpression(staticValues.get(value.name));
    return resolved?.type === 'ObjectExpression' ? resolved : undefined;
  };

  const isSafeExposureOrigin = (value: string): boolean => {
    try {
      const url = new URL(value);
      const isLoopback =
        url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
      return (
        url.origin === value &&
        (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback))
      );
    } catch {
      return false;
    }
  };

  const inspectExposure = (call: CallExpression): void => {
    const optionsArgument = call.arguments[1];
    const options =
      optionsArgument && optionsArgument.type !== 'SpreadElement'
        ? staticObject(optionsArgument)
        : undefined;
    if (!options) {
      if (optionsArgument) {
        findings.push({
          code: 'dynamic-origin-exposure',
          file,
          ...location(call, lineOffset),
          message: 'Dynamic Siteverb registration options require manual exposedTo review.',
          severity: 'warning',
        });
      }
      return;
    }
    const exposedTo = propertyValue(options, 'exposedTo');
    if (!exposedTo) return;
    const resolved = unwrapExpression(
      exposedTo.type === 'Identifier' ? staticValues.get(exposedTo.name) : exposedTo,
    );
    if (
      resolved?.type !== 'ArrayExpression' ||
      resolved.elements.some((element) => element?.type !== 'StringLiteral')
    ) {
      findings.push({
        code: 'dynamic-origin-exposure',
        file,
        ...location(exposedTo, lineOffset),
        message: 'Siteverb exposedTo must use reviewed static origin literals for source coverage.',
        severity: 'warning',
      });
      return;
    }
    for (const element of resolved.elements) {
      if (element?.type !== 'StringLiteral' || isSafeExposureOrigin(element.value)) continue;
      findings.push({
        code: 'unsafe-origin-exposure',
        file,
        ...location(element, lineOffset),
        message: `Siteverb exposedTo value "${element.value}" is not an exact secure origin.`,
        severity: 'error',
      });
    }
  };

  walk(source.program, (node) => {
    if (node.type !== 'CallExpression') return;
    const calleePath = memberPath(node.callee);
    if (calleePath && /^(?:document|navigator)\.modelContext\.registerTool$/.test(calleePath)) {
      findings.push({
        code: 'raw-native-registration',
        file,
        ...location(node, lineOffset),
        message: 'Raw native registration bypasses Siteverb callback coverage.',
        severity: 'error',
      });
    }

    if (isToolDefinitionCall(node)) {
      const first = node.arguments[0];
      const position = location(node, lineOffset);
      const objects = first && first.type !== 'SpreadElement' ? resolveToolObjects(first) : [];
      if (objects.length === 0) {
        findings.push({
          code: 'dynamic-tool-metadata',
          file,
          ...position,
          message: 'Siteverb tool definitions must resolve to static objects for source coverage.',
          severity: 'warning',
        });
        return;
      }
      objects.forEach(addTool);
      inspectExposure(node);
      return;
    }

    const registrationPath = memberPath(node.callee);
    const registrationMethod = registrationPath?.split('.').at(-1);
    const clientName = registrationPath?.split('.').at(-2);
    const directFactoryClient =
      node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'CallExpression' &&
      isSiteverbFactory(node.callee.object);
    if (
      (registrationMethod !== 'registerTool' && registrationMethod !== 'registerTools') ||
      (!directFactoryClient && (!clientName || !siteverbClients.has(clientName)))
    ) {
      return;
    }
    const first = node.arguments[0];
    const objects = first && first.type !== 'SpreadElement' ? resolveToolObjects(first) : [];
    if (objects.length === 0) {
      findings.push({
        code: 'dynamic-tool-metadata',
        file,
        ...location(node, lineOffset),
        message: 'Siteverb registrations must resolve to static tool objects for source coverage.',
        severity: 'warning',
      });
      return;
    }
    objects.forEach(addTool);
    inspectExposure(node);
  });
  return { filesScanned: 1, findings, tools };
}

function attribute(node: DefaultTreeAdapterMap['element'], name: string): string | undefined {
  return node.attrs.find((candidate) => candidate.name === name)?.value;
}

function hasAttribute(node: DefaultTreeAdapterMap['element'], name: string): boolean {
  return node.attrs.some((candidate) => candidate.name === name);
}

function scanMarkup(path: string, root: string, sourceText: string): ScanResult {
  const file = relative(root, path);
  const tools: SourceTool[] = [];
  const findings: AuditFinding[] = [];
  const document = parse(sourceText, { sourceCodeLocationInfo: true });
  const visit = (node: DefaultTreeAdapterMap['node']): void => {
    if ('tagName' in node && node.tagName === 'form') {
      const name = attribute(node, 'toolname');
      if (name) {
        const start = node.sourceCodeLocation?.startTag;
        tools.push({
          file,
          line: start?.startLine ?? 1,
          column: start?.startCol ?? 1,
          name,
          ...(hasAttribute(node, 'toolautosubmit') ? { autoSubmit: true } : {}),
          owner: 'declarative',
        });
      }
    }
    if ('tagName' in node && node.tagName === 'script') {
      const sourceReference = attribute(node, 'src');
      if (sourceReference && isExternalRuntimeReference(sourceReference)) {
        const start = node.sourceCodeLocation?.startTag;
        findings.push({
          code: 'external-registration-runtime',
          file,
          line: start?.startLine ?? 1,
          column: start?.startCol ?? 1,
          message: `External WebMCP registration runtime "${sourceReference}" requires an explicit coexistence or migration decision.`,
          severity: 'warning',
        });
      }
      const type = attribute(node, 'type')?.toLowerCase();
      if (!sourceReference && (!type || type === 'module' || /javascript|typescript/.test(type))) {
        for (const child of node.childNodes) {
          if (!('value' in child) || !child.value.trim()) continue;
          const scriptLocation = child.sourceCodeLocation;
          const scanned = scanSource(path, root, child.value, (scriptLocation?.startLine ?? 1) - 1);
          findings.push(...scanned.findings);
          tools.push(...scanned.tools);
        }
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  };
  visit(document);
  return { filesScanned: 1, findings, tools };
}

async function collectFiles(directory: string, output: string[], limit: number): Promise<void> {
  if (output.length >= limit)
    throw new Error(`Source audit exceeded the ${limit}-file safety limit.`);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink() || ignoredDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(path, output, limit);
    else if (
      sourceExtension.test(entry.name) ||
      htmlExtension.test(entry.name) ||
      componentExtension.test(entry.name)
    )
      output.push(path);
  }
}

export async function scanProjectSources(root: string, limit = 10_000): Promise<ScanResult> {
  const paths: string[] = [];
  await collectFiles(root, paths, limit);
  const result: ScanResult = { filesScanned: 0, findings: [], tools: [] };
  for (const path of paths) {
    const source = await readFile(path, 'utf8');
    const scanned = sourceExtension.test(path)
      ? scanSource(path, root, source)
      : scanMarkup(path, root, source);
    result.filesScanned += scanned.filesScanned;
    result.findings.push(...scanned.findings);
    result.tools.push(...scanned.tools);
  }
  return result;
}
