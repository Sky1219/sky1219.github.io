// The projector in the lecture hall: workshop slides on what we actually build with at HackUTD. Retrieval
// (RAG), tool calls, agents, and MCP, each as a diagram that plays out step by step.
import { Screen, C, MONO, SANS, text, box, arrow, ease, clamp, wrap } from './kit.js';

const INK = '#e9edf3', DIM = '#8d97a8', LINE = '#3a4352', CARD = '#141a23';
const node = (ctx, x, y, w, h, label, { on = true, sub = '', color = INK, fill = CARD } = {}) => {
  ctx.save(); ctx.globalAlpha *= on ? 1 : 0.3;
  box(ctx, x, y, w, h, { fill, stroke: on ? color : LINE, lw: 2, r: 10 });
  text(ctx, label, x + w / 2, y + h / 2 - (sub ? 8 : 0), { size: 15, font: SANS, weight: '700', color, align: 'center' });
  if (sub) text(ctx, sub, x + w / 2, y + h / 2 + 12, { size: 11.5, color: DIM, align: 'center' });
  ctx.restore();
};
// a dot travelling along a line, for "data moving here"
const packet = (ctx, x0, y0, x1, y1, k, color = C.acc) => { if (k <= 0 || k >= 1) return; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 6, 0, 6.29); ctx.fill(); ctx.shadowBlur = 0; };
const mono = (ctx, lines, x, y, { size = 12.5, color = INK, lh = 18, k = 1 } = {}) => lines.slice(0, Math.ceil(lines.length * clamp(k, 0, 1))).forEach((l, i) => text(ctx, l, x, y + i * lh, { size, color }));

export class SlidesScreen extends Screen {
  constructor(w, h) { super(w, h, [11, 11, 12, 11]); }
  draw(ctx) {
    const { w, h } = this, st = this.step, k = this.pt;
    box(ctx, 0, 0, w, h, { fill: '#0b0e13' });
    const titles = ['Retrieval-augmented generation (RAG)', 'Tool calls', 'Agents', 'Model Context Protocol (MCP)'];
    const subs = ['The model answers from your documents, not just its training data.', 'The model asks; your code does it; the result goes back.', 'Tools in a loop: think, act, observe, until the goal is met.', 'One standard way to plug tools and data into any AI app.'];
    text(ctx, `${st + 1} / 4`, w - 36, 36, { size: 13, color: DIM, align: 'right' });
    text(ctx, titles[st], 36, 38, { size: 28, font: SANS, weight: '800', color: INK });
    text(ctx, subs[st], 36, 72, { size: 15, font: SANS, color: DIM });
    box(ctx, 36, 92, 64, 4, { fill: C.acc });
    [this.rag, this.tools, this.agents, this.mcp][st].call(this, ctx, k);
    text(ctx, 'HackUTD workshop · building with AI', 36, h - 20, { size: 12, color: DIM });
  }
  rag(ctx, k) {
    const y = 250;
    node(ctx, 30, y - 30, 150, 60, 'Question', { sub: '"When is the CTF?"' });
    node(ctx, 230, y - 30, 120, 60, 'Embed', { on: k > 1, sub: 'text → vector' });
    // the index: chunks of the docs, three of them closest
    const ix = 400, iy = 130;
    box(ctx, ix, iy, 220, 250, { fill: '#10151c', stroke: k > 2 ? C.blue : LINE, lw: 2, r: 12 });
    text(ctx, 'Vector index', ix + 110, iy + 20, { size: 14, font: SANS, weight: '700', color: C.blue, align: 'center' });
    const docs = ['schedule.md #2', 'faq.md #7', 'rules.md #1', 'schedule.md #5', 'sponsors.md #3', 'ctf.md #1'], hit = [0, 5, 3];
    docs.forEach((d, i) => { const on = k > 3.2 && hit.includes(i); box(ctx, ix + 16, iy + 40 + i * 34, 188, 26, { fill: on ? 'rgba(255,138,61,0.18)' : CARD, stroke: on ? C.acc : LINE, r: 6 }); text(ctx, d, ix + 28, iy + 53 + i * 34, { size: 12, color: on ? INK : DIM }); if (on) text(ctx, `${(0.91 - hit.indexOf(i) * 0.06).toFixed(2)}`, ix + 192, iy + 53 + i * 34, { size: 11, color: C.acc, align: 'right' }); });
    // the prompt that gets built, then the answer
    const px = 670, pw = 320;
    ctx.save(); ctx.globalAlpha = clamp(k - 4.5, 0.25, 1);
    box(ctx, px, 130, pw, 160, { fill: '#10151c', stroke: k > 4.5 ? C.acc : LINE, lw: 2, r: 12 });
    text(ctx, 'Prompt to the model', px + 14, 148, { size: 13, font: SANS, weight: '700', color: C.acc });
    mono(ctx, ['Answer using only these sources:', '[1] CTF opens Sat 2 PM, online...', '[2] Final hour starts 2 AM...', '[3] Flags are submitted on...', 'Q: When is the CTF?'], px + 14, 174, { size: 11.5, k: (k - 4.5) / 1.5 });
    ctx.restore();
    node(ctx, px, 312, 110, 54, 'LLM', { on: k > 6.5, color: C.acc });
    ctx.save(); ctx.globalAlpha = clamp(k - 7.5, 0, 1);
    box(ctx, px + 130, 306, pw - 130, 66, { fill: '#10151c', stroke: C.ok, lw: 2, r: 10 });
    mono(ctx, ['It opens Saturday at 2 PM', 'and runs online all night. [1][2]'], px + 142, 328, { size: 11.5, color: INK });
    ctx.restore();
    ctx.globalAlpha = 1;
    arrow(ctx, 180, y, 226, y, LINE); arrow(ctx, 350, y, 396, y, LINE); arrow(ctx, 620, y - 40, 666, y - 40, LINE); arrow(ctx, px + 55, 290, px + 55, 308, LINE);
    packet(ctx, 180, y, 226, y, k - 0.5); packet(ctx, 350, y, 396, y, k - 1.8); packet(ctx, 620, y - 40, 666, y - 40, (k - 3.8) * 1.2); packet(ctx, px + 55, 290, px + 55, 308, (k - 6) * 2);
    text(ctx, 'Retrieve the closest chunks, put them in the prompt, and ask for citations.', 36, 430, { size: 15, font: SANS, color: INK });
  }
  tools(ctx, k) {
    const lanes = [['You', 100], ['Model', 340], ['Your code', 600], ['Weather API', 860]];
    lanes.forEach(([l, x]) => { text(ctx, l, x, 124, { size: 15, font: SANS, weight: '700', color: INK, align: 'center' }); ctx.strokeStyle = LINE; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(x, 140); ctx.lineTo(x, 440); ctx.stroke(); ctx.setLineDash([]); });
    const msgs = [
      [100, 340, 'What\'s the weather at UTD?', INK],
      [340, 600, 'tool_call: get_weather({"city": "Richardson, TX"})', C.acc],
      [600, 860, 'GET /forecast?q=Richardson', C.blue],
      [860, 600, '{"temp_f": 78, "sky": "clear"}', C.blue],
      [600, 340, 'tool_result: {"temp_f": 78, "sky": "clear"}', C.ok],
      [340, 100, 'It\'s 78°F and clear in Richardson.', INK],
    ];
    msgs.forEach(([a, b, s, c], i) => {
      const t = k - 0.8 - i * 1.5; if (t < 0) return;
      const y = 166 + i * 48, e = ease(t / 0.6);
      arrow(ctx, a, y, a + (b - a) * e, y, c, 2);
      ctx.save(); ctx.globalAlpha = clamp(t * 2, 0, 1); text(ctx, s, (a + b) / 2, y - 12, { size: 12.5, color: c, align: 'center' }); ctx.restore();
    });
    text(ctx, 'The model never runs anything itself: it writes a structured request, and your code decides.', 36, 470, { size: 15, font: SANS, color: INK });
  }
  agents(ctx, k) {
    const cx = 250, cy = 280, R = 120;
    const ph = ['Think', 'Act', 'Observe'];
    const LOG = [
      [0, 'goal: make the failing test pass'], [0, 'think: run the tests to see what breaks'], [1, 'act: run_tests()'], [2, 'observe: 1 failed, test_parse_date'],
      [0, 'think: read the parser'], [1, 'act: read_file("parser.py")'], [2, 'observe: format string is "%d/%m"'], [0, 'think: dates are US style here'],
      [1, 'act: edit_file("parser.py", "%m/%d")'], [1, 'act: run_tests()'], [2, 'observe: 42 passed'], [0, 'done: goal met'],
    ];
    const n = clamp(Math.floor(k / 0.85), 0, LOG.length), cur = n ? LOG[n - 1][0] : 0;
    text(ctx, 'Goal', cx, cy - 6, { size: 15, font: SANS, weight: '700', color: INK, align: 'center' });
    text(ctx, 'tests pass', cx, cy + 14, { size: 12, color: DIM, align: 'center' });
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.29); ctx.stroke();
    ph.forEach((p, i) => {
      const a = -Math.PI / 2 + i * (2 * Math.PI / 3), x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, on = i === cur;
      box(ctx, x - 56, y - 22, 112, 44, { fill: on ? 'rgba(255,138,61,0.2)' : CARD, stroke: on ? C.acc : LINE, lw: 2, r: 22 });
      text(ctx, p, x, y + 1, { size: 15, font: SANS, weight: '700', color: on ? C.acc : INK, align: 'center' });
    });
    const sp = (k * 1.2) % (2 * Math.PI), ax = cx + Math.cos(sp - Math.PI / 2) * R, ay = cy + Math.sin(sp - Math.PI / 2) * R;
    ctx.fillStyle = C.acc; ctx.beginPath(); ctx.arc(ax, ay, 5, 0, 6.29); ctx.fill();
    box(ctx, 470, 120, 520, 330, { fill: '#0a0e13', stroke: LINE, r: 10 });
    text(ctx, 'agent log', 486, 138, { size: 12, color: DIM });
    LOG.slice(0, n).forEach(([p, s], i) => text(ctx, s, 486, 162 + i * 23, { size: 12.5, color: s.startsWith('done') ? C.ok : p === 1 ? C.acc : p === 2 ? C.blue : INK }));
    text(ctx, 'Give the model tools and a goal, and let it loop until it can check the goal is met.', 36, 480, { size: 15, font: SANS, color: INK });
  }
  mcp(ctx, k) {
    const hosts = ['Claude', 'VS Code', 'Your app'], servers = [['GitHub', 'issues, PRs'], ['Postgres', 'query'], ['Files', 'read, write'], ['Calendar', 'events']];
    hosts.forEach((hname, i) => { const y = 140 + i * 100; box(ctx, 40, y, 220, 76, { fill: CARD, stroke: LINE, lw: 2, r: 10 }); text(ctx, hname, 60, y + 24, { size: 15, font: SANS, weight: '700', color: INK }); box(ctx, 150, y + 38, 96, 26, { fill: '#1f160e', stroke: C.acc, r: 6 }); text(ctx, 'MCP client', 198, y + 51, { size: 11.5, color: C.acc, align: 'center' }); });
    servers.forEach(([s, d], i) => { const y = 124 + i * 82; box(ctx, 730, y, 240, 62, { fill: CARD, stroke: C.blue, lw: 2, r: 10 }); text(ctx, `${s} server`, 748, y + 22, { size: 15, font: SANS, weight: '700', color: INK }); text(ctx, d, 748, y + 44, { size: 12, color: DIM }); });
    // every client can reach every server
    ctx.lineWidth = 1;
    hosts.forEach((_, i) => servers.forEach((__, j) => { ctx.strokeStyle = 'rgba(88,166,255,0.18)'; ctx.beginPath(); ctx.moveTo(246, 191 + i * 100); ctx.lineTo(730, 155 + j * 82); ctx.stroke(); }));
    // one conversation, spelled out
    const conv = [[0, 0, '→ initialize'], [0, 0, '→ tools/list'], [0, 0, '← [create_issue, list_prs, ...]'], [0, 0, '→ tools/call create_issue {...}'], [0, 0, '← {"number": 128}']];
    const i = clamp(Math.floor(k / 1.6), 0, conv.length), x0 = 246, y0 = 191, x1 = 730, y1 = 155;
    ctx.strokeStyle = C.acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const f = (k / 1.6) % 1, back = i < conv.length && conv[i][2].startsWith('←');
    if (i < conv.length) packet(ctx, back ? x1 : x0, back ? y1 : y0, back ? x0 : x1, back ? y0 : y1, f);
    box(ctx, 300, 330, 380, 150, { fill: '#0a0e13', stroke: LINE, r: 10 });
    text(ctx, 'JSON-RPC between client and server', 316, 348, { size: 12, color: DIM });
    conv.slice(0, i + 1).forEach(([, , s], n) => text(ctx, s, 316, 372 + n * 21, { size: 12.5, color: s.startsWith('←') ? C.blue : C.acc }));
    text(ctx, 'Write a server once, and every MCP app can use its tools.', 36, 506, { size: 15, font: SANS, color: INK });
  }
}
