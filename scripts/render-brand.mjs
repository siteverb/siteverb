#!/usr/bin/env node

import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const outputs = [
  {
    source: 'brand/siteverb-mark.svg',
    output: 'brand/siteverb-avatar.png',
    width: 512,
    height: 512,
  },
  {
    source: 'brand/siteverb-social-preview.svg',
    output: 'brand/siteverb-social-preview.png',
    width: 1280,
    height: 640,
  },
];
const browser = await puppeteer.launch({ browser: 'chrome', channel: 'chrome', headless: true });

try {
  for (const item of outputs) {
    const svg = await readFile(resolve(item.source), 'utf8');
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: item.width, height: item.height, deviceScaleFactor: 1 });
      const data = Buffer.from(svg).toString('base64');
      await page.setContent(
        `<!doctype html><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}img{display:block;width:100%;height:100%}</style><img alt="" src="data:image/svg+xml;base64,${data}">`,
      );
      await page.locator('img').waitHandle();
      await mkdir(resolve(item.output, '..'), { recursive: true });
      await page.screenshot({ path: resolve(item.output), type: 'png' });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
