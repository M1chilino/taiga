// Gera as imagens 3D do site (logo do hero e ícones dos serviços) em src/assets/3d/.
// Uso: npm run render:3d   (precisa do Edge ou Chrome instalado)
//
// As imagens são renderizadas uma única vez, aqui, com three.js. O site em produção
// só exibe os PNGs prontos: não roda WebGL nem three.js no navegador de quem acessa.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(root, 'src/assets/3d');

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('Edge/Chrome não encontrado. Defina CHROME_PATH.');

const bundle = await build({
  entryPoints: [path.join(here, 'scene.js')],
  bundle: true,
  format: 'iife',
  globalName: 'TaigaScene',
  write: false,
  logLevel: 'error',
});
const code = bundle.outputFiles[0].text;
const markSvg = fs.readFileSync(path.join(root, 'src/assets/logos/icone-verde.svg'), 'utf8');

const browser = await chromium.launch({
  executablePath,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage();
await page.setContent('<body></body>');
await page.addScriptTag({ content: code });

const shoot = (fn, args) =>
  page.evaluate(
    ({ fn, args }) => {
      const canvas = document.createElement('canvas');
      document.body.append(canvas);
      const url = window.TaigaScene[fn](canvas, ...args);
      canvas.remove();
      return url;
    },
    { fn, args },
  );

const save = async (dataUrl, name, width) => {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  // renderiza grande e reduz: serve de antialiasing extra
  await sharp(buf).resize({ width, kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(path.join(outDir, name));
  console.log('ok', name);
};

fs.mkdirSync(outDir, { recursive: true });
await save(await shoot('renderHero', [markSvg, 3000, 2200]), 'logo-3d.png', 1500);
for (const [kind, name] of [
  ['search', 'icone-analise.png'],
  ['chart', 'icone-gestao.png'],
  ['play', 'icone-videos.png'],
]) {
  await save(await shoot('renderIcon', [kind, 1200]), name, 600);
}
await browser.close();
