import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const ACTION_PATH =
  'M75 74h197c12 0 24 5 32 14l151 146c13 12 13 32 0 44L304 424c-8 9-20 14-32 14H75c-18 0-33-15-33-33V107c0-18 15-33 33-33Z';
const SVG_ASSETS = [
  'brand/siteverb-mark.svg',
  'brand/siteverb-favicon.svg',
  'brand/siteverb-wordmark.svg',
  'brand/siteverb-social-preview.svg',
] as const;

function pngDimensions(bytes: Buffer): readonly [number, number] {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('brand assets', () => {
  it('keeps one forward-lane geometry across every vector treatment', async () => {
    for (const path of SVG_ASSETS) {
      const source = await readFile(path, 'utf8');
      expect(source).toContain(ACTION_PATH);
      expect(source.match(/<rect y="(?:72|136|200|264|328|392)"/g)).toHaveLength(6);
      expect(source).not.toContain('<mask');
    }
  });

  it('keeps the primary mark transparent and the favicon contrast-safe', async () => {
    const [mark, favicon] = await Promise.all([
      readFile('brand/siteverb-mark.svg', 'utf8'),
      readFile('brand/siteverb-favicon.svg', 'utf8'),
    ]);

    expect(mark).not.toContain('<rect width="512" height="512" rx="112"');
    expect(favicon).toContain('<rect width="512" height="512" rx="112" fill="#f4f7f2"');
  });

  it('renders canonical PNGs at their documented dimensions', async () => {
    const [avatar, socialPreview] = await Promise.all([
      readFile('brand/siteverb-avatar.png'),
      readFile('brand/siteverb-social-preview.png'),
    ]);

    expect(pngDimensions(avatar)).toEqual([512, 512]);
    expect(pngDimensions(socialPreview)).toEqual([1280, 640]);
  });
});
