import { defineTool, isDefinedTool } from '../validation.js';
import type { AnySiteverbTool, JsonSchema, WebMcpToolAnnotations } from '../types.js';

export interface WebMcpEvalsToolSchema {
  readonly annotations?: WebMcpToolAnnotations;
  readonly description: string;
  readonly inputSchema: JsonSchema | null;
  readonly name: string;
  readonly outputSchema: null;
}

export interface WebMcpEvalsSchema {
  readonly tools: readonly WebMcpEvalsToolSchema[];
}

export function toWebMcpEvalsSchema(tools: readonly AnySiteverbTool[]): WebMcpEvalsSchema {
  const names = new Set<string>();
  const exported = tools.map((candidate) => {
    const tool = isDefinedTool(candidate) ? candidate : defineTool(candidate);
    if (names.has(tool.name)) {
      throw new TypeError(`Cannot export duplicate WebMCP tool name "${tool.name}".`);
    }
    names.add(tool.name);

    return Object.freeze({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema ?? null,
      outputSchema: null,
      ...(tool.annotations === undefined ? {} : { annotations: tool.annotations }),
    });
  });

  return Object.freeze({ tools: Object.freeze(exported) });
}
