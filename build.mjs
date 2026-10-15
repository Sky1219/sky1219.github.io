// Builds the site into dist/: the page (with the campus plan inlined), the styles, the JS (three.js and the
// visuals are split out and only load when a tour opens), and the data and room models from public/.
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, chmodSync, statSync, watchFile } from 'node:fs';
import { join } from 'node:path';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
const page = () => {
  const html = readFileSync('src/index.html', 'utf8').replace('{{PLAN}}', readFileSync('src/campus-plan.svg', 'utf8')
    // the buildings twice: outlines that draw themselves in, and a fill of lit windows
    .replace(/<path class="plan-buildings" d="([^"]*)"\/>/, '<path class="plan-lit" d="$1"/><path class="plan-buildings" pathLength="1" d="$1"/>')
    .replace(/<path class="plan-hot"/g, '<path class="plan-hot" pathLength="1"'));
  writeFileSync('dist/index.html', html);
  cpSync('src/styles.css', 'dist/styles.css');
};
page();
// data and room models: copied once. (Rebuilds only redo the page; overwriting a read-only copy fails on Windows.)
cpSync('public', 'dist', { recursive: true });
for (const f of readdirSync('dist', { recursive: true })) { const p = join('dist', f); if (statSync(p).isFile()) chmodSync(p, 0o666); }
const opts = {
  entryPoints: ['src/main.js'], outdir: 'dist/js', bundle: true, splitting: true, format: 'esm',
  minify: !watch, sourcemap: watch, target: 'es2020', logLevel: 'info',
};
// the in-browser GPT-2 runs in its own worker script (src/llm/worker.js)
const workerOpts = { entryPoints: { 'llm-worker': 'src/llm/worker.js' }, outdir: 'dist/js', bundle: true, format: 'iife', minify: !watch, target: 'es2020', logLevel: 'warning' };
if (watch) {
  const ctx = await context({ ...opts, plugins: [{ name: 'page', setup(b) { b.onEnd(page); } }] });
  await (await context(workerOpts)).watch();
  await ctx.watch();
  for (const f of ['src/index.html', 'src/styles.css', 'src/campus-plan.svg']) watchFile(f, { interval: 500 }, page);   // the page and styles aren't in the JS graph
  await ctx.serve({ servedir: 'dist', port: 5173 });
  console.log('http://localhost:5173');
} else {
  await Promise.all([build(opts), build(workerOpts)]);
}
