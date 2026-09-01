import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { projectContractJsonSchema, runReportJsonSchema } from '../dist/schema.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaDirectory = resolve(packageRoot, 'schema');
await mkdir(schemaDirectory, { recursive: true });
await Promise.all(
  [
    ['siteverb.webmcp.schema.json', projectContractJsonSchema],
    ['report.schema.json', runReportJsonSchema],
  ].map(async ([name, schema]) => {
    const path = resolve(schemaDirectory, name);
    const options = (await resolveConfig(path)) ?? {};
    return writeFile(path, await format(JSON.stringify(schema), { ...options, filepath: path }));
  }),
);
