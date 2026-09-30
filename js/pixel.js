/* pixel.js: all pixel art. Icons are 8x8 grids where # is a filled pixel.
   The hero sprite is 16x20 and gains gear each tier. */
import { TIERS } from './config.js';

export const ICONS = {
  /* trees + nav (from the original app) */
  book:['.##..##.','#..##..#','#..##..#','#..##..#','#..##..#','#..##..#','.##..##.','...##...'],
  gear:['...##...','.######.','.##..##.','###..###','###..###','.##..##.','.######.','...##...'],
  bulb:['..####..','.#....#.','.#....#.','.#....#.','..#..#..','...##...','..####..','...##...'],
  case:['..####..','..#..#..','########','#......#','########','#......#','#......#','########'],
  bell:['........','.#....#.','##....##','########','##....##','.#....#.','........','........'],
  heart:['........','.##..##.','########','########','.######.','..####..','...##...','........'],
  glass:['########','.#....#.','..#..#..','...##...','...##...','..#..#..','.#....#.','########'],
  star:['...##...','...##...','########','.######.','..####..','.##..##.','.#....#.','........'],
  home:['...##...','..####..','.######.','########','.#....#.','.#.##.#.','.#.##.#.','.######.'],
  list:['........','##.#####','........','##.#####','........','##.#####','........','........'],
  scroll:['.######.','#......#','.#.###.#','.#.....#','.#.###.#','.#.....#','.######.','........'],
  cog:['#.#..#.#','.######.','##....##','.#.##.#.','.#.##.#.','##....##','.######.','#.#..#.#'],
  /* new */
  hero:['...##...','..####..','..####..','...##...','.######.','#.####.#','..#..#..','..#..#..'],
  play:['..#.....','..##....','..###...','..####..','..####..','..###...','..##....','..#.....'],
  bolt:['...###..','..###...','.###....','.######.','...###..','..###...','.##.....','.#......'],
  target:['..####..','.#....#.','#..##..#','#.####.#','#.####.#','#..##..#','.#....#.','..####..'],
  rocket:['...##...','..####..','..#..#..','..####..','..####..','.######.','.#.##.#.','...##...'],
  gem:['........','..####..','.##..##.','########','.#....#.','..#..#..','...##...','........'],
  cal:['.#....#.','########','########','#......#','#.##.#.#','#......#','#.#.##.#','########'],
  disk:['#######.','#.###.##','#.###..#','#......#','#.####.#','#.#..#.#','#.####.#','########'],
  phone:['.######.','.#....#.','.#....#.','.#....#.','.#....#.','.######.','.##..##.','.######.'],
  flame:['...#....','...##...','..###.#.','..#####.','.###.##.','.##..##.','.##..##.','..####..'],
  check:['........','.......#','......##','#....##.','##..##..','.####...','..##....','........'],
  sun:['#..##..#','.#....#.','..####..','#.####.#','#.####.#','..####..','.#....#.','#..##..#'],
  moon:['..###...','.##.....','##......','##......','##......','##.....#','.##...##','..#####.'],
  sword:['......##','.....###','....###.','#..###..','.####...','..##....','.#.##...','#...#...'],
  pot:['........','.#.#.#..','........','########','.######.','.######.','.######.','..####..'],
  flag:['.#......','.######.','.#####..','.######.','.#......','.#......','.#......','###.....'],
  map:['##..##..','#.##..##','#.#.#..#','#..#.#.#','#.#.#..#','#..#.#.#','##..##.#','..##..##'],
  skull:['.######.','########','#..##..#','#..##..#','########','.##..##.','.######.','.#.##.#.'],
  up:['...##...','..####..','.######.','########','...##...','...##...','...##...','...##...'],
  shield:['########','#......#','#.####.#','#.####.#','#.####.#','.#.##.#.','..#..#..','...##...'],
  crown:['........','#..##..#','##.##.##','########','#.####.#','########','########','........'],
  mail:['........','########','##....##','#.#..#.#','#..##..#','#......#','########','........'],
  link:['........','.###....','#...#...','#..###..','.###..#.','...#..#.','....###.','........'],
  tie:['..####..','...##...','..####..','..####..','.######.','.######.','..####..','...##...'],
  wrench:['.....#.#','.....###','....###.','...###..','..###...','.###....','###.....','.#......'],
  medal:['.#....#.','..#..#..','...##...','..####..','.##..##.','.#.##.#.','.##..##.','..####..'],
  flask:['..####..','...##...','...##...','..#..#..','.#....#.','#.####.#','#.####.#','.######.'],
  cap:['........','...##...','.######.','########','.######.','..####.#','..####.#','.......#'],
  ball:['........','..####..','.######.','##.#.#.#','#.#.#.##','.######.','..####..','........'],
  lock:['..####..','.#....#.','.#....#.','########','###..###','###..###','########','########'],
  quest:['.######.','#......#','#.####.#','#......#','#.###..#','#......#','.######.','........']
};

export function pix(name, color, cls) {
  const m = ICONS[name] || ICONS.star; let r = '';
  m.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; });
  return `<svg class="ic ${cls || ''}" viewBox="0 0 8 8" aria-hidden="true" shape-rendering="crispEdges" style="fill:${color || 'currentColor'}">${r}</svg>`;
}

/* ---------- tier crest (shield) ---------- */
const SHIELD = ['XXXXXXXXXXXX','XffffffffffX','XfhhhhhhhhfX','XfhffffffffX','XfhffffffffX','XffffffffffX','XffffffffffX','.XffffffffX.','.XffffffffX.','..XffffffX..','...XffffX...','....XXXX....'];
export function crest(tierIdx) {
  const c = `var(${TIERS[tierIdx][2]})`; let r = '';
  SHIELD.forEach((row, y) => { for (let x = 0; x < 12; x++) { const ch = row[x];
    if (ch === 'X') r += `<rect x="${x}" y="${y}" width="1" height="1" style="fill:${c}"/>`;
    else if (ch === 'f') r += `<rect x="${x}" y="${y}" width="1" height="1" style="fill:${c};opacity:.28"/>`;
    else if (ch === 'h') r += `<rect x="${x}" y="${y}" width="1" height="1" style="fill:${c};opacity:.55"/>`; } });
  return `<svg viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${r}</svg><b>${TIERS[tierIdx][0]}</b>`;
}

/* ---------- hero sprite: 16 wide x 20 tall, layered by tier ---------- */
const BASE = [
  '................',
  '.....oooooo.....',
  '....ohhhhhho....',
  '...ohhhhhhhho...',
  '...ohssssssho...',
  '...ossessesso...',
  '...osssssssso...',
  '....ossSSsso....',
  '......oSSo......',
  '...otttttttto...',
  '..otttttttttto..',
  '..ottTttttTtto..',
  '..ottTttttTtto..',
  '..osTttttttTso..',
  '..oooppppppooo..',
  '....oppppppo....',
  '....oppooppo....',
  '....oppooppo....',
  '...obbboobbbo...',
  '...oooooooooo...'
];
/* each layer: rows of 16 chars, '.' = leave the pixel below alone */
const L_CAPE = [                // tier IV+: cape drawn behind the body
  '', '', '', '', '', '', '', '', '',
  '...cccccccccc...',
  '..cccccccccccc..',
  '.cccccccccccccc.',
  '.cccccccccccccc.',
  '.cccccccccccccc.',
  '.cccccccccccccc.',
  '.cccccccccccccc.',
  '.cccccccccccccc.',
  '.cccccccccccccc.',
  '.CCCCCCCCCCCCCC.'
];
const L_BELT = [                // tier II+: tool belt + wrench
  '', '', '', '', '', '', '',
  '.............m.m',
  '.............mmm',
  '..............m.',
  '..............m.',
  '..............m.',
  '..............m.',
  '....bbbggbbb.m..'
];
const L_HAT = [                 // tier III+: hard hat
  '.....oooooo.....',
  '....oyyYyyyo....',
  '...oyyYyyyyyo...',
  '..oyyyyyyyyyyo..'
];
const L_GOGGLES = [             // tier IV+: goggles on the hat + shoulder pads
  '', '',
  '...oyllyyllyo...',
  '', '', '', '', '', '',
  '..omm......mmo..',
  '..omM......Mmo..'
];
const L_CROWN = [               // tier V: gem on the hat + gold aura
  'a.....orro.....a',
  '....oyyrryyo....',
  '', '',
  'a..............a',
  '', '', '',
  '.a............a.',
  '', '', '', '', '', '',
  '.a............a.'
];

const PAL = {
  o:'#0c0c12', h:'#3d2f2a', s:'#c9a07e', S:'#a67c5f', e:'#14141c', p:'#3b3a50', b:'#2a2433',
  g:'var(--gold)', m:'#8d93a0', M:'#5d6270', y:'#c7a25b', Y:'#dfc285', l:'#6fa39b', r:'#b86660', a:'#dfc285'
};
const CAPES = [null, null, null, ['#7a3b45', '#5a2a33'], ['#5a3d6e', 'var(--gold)']];

export function heroSprite(tier, silhouette) {
  const grid = Array.from({ length: 20 }, () => Array(16).fill(null));
  const paint = (layer, map) => layer.forEach((row, y) => { for (let x = 0; x < row.length && x < 16; x++) { const ch = row[x]; if (ch !== '.' && ch !== ' ') grid[y][x] = map(ch); } });
  const tc = `var(${TIERS[tier][2]})`;
  const pal = ch => {
    if (ch === 't') return [tc, 1];
    if (ch === 'T') return [tc, .6];
    if (ch === 'c') return [CAPES[tier] ? CAPES[tier][0] : tc, 1];
    if (ch === 'C') return [CAPES[tier] ? CAPES[tier][1] : tc, 1];
    if (tier >= 4 && (ch === 'y')) return ['var(--gold-hi)', 1];
    if (tier >= 4 && (ch === 'm' || ch === 'M')) return [ch === 'm' ? 'var(--gold)' : 'var(--gold-lo)', 1];
    return [PAL[ch] || '#f0f', 1];
  };
  if (tier >= 3) paint(L_CAPE, pal);
  paint(BASE, pal);
  if (tier >= 1) paint(L_BELT, pal);
  if (tier >= 2) paint(L_HAT, pal);
  if (tier >= 3) paint(L_GOGGLES, pal);
  if (tier >= 4) paint(L_CROWN, pal);
  let r = '';
  grid.forEach((row, y) => row.forEach((c, x) => {
    if (!c) return;
    r += silhouette ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : `<rect x="${x}" y="${y}" width="1" height="1" style="fill:${c[0]}${c[1] < 1 ? ';opacity:' + c[1] : ''}"/>`;
  }));
  return `<svg class="hero-svg${silhouette ? ' sil' : ''}" viewBox="0 0 16 20" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}
export const HERO_GEAR = ['Plain tunic', 'Tool belt + wrench', 'Hard hat', 'Goggles, pauldrons + cape', 'Chief\'s gold helm + royal cape'];

/* ---------- pixel radar: a heptagon chart drawn as a grid of square pixels ---------- */
export function pixelRadar(values, colors, opt) {
  opt = opt || {};
  const N = 41, C = 20, R = 18, k = values.length;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / k;
  const pt = (i, v) => [C + Math.cos(ang(i)) * R * v, C + Math.sin(ang(i)) * R * v];
  const poly = values.map((v, i) => pt(i, Math.max(.04, Math.min(1, v))));
  const inside = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const onEdge = (x, y, P) => { for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [x1, y1] = P[j], [x2, y2] = P[i]; const dx = x2 - x1, dy = y2 - y1; const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))); if (Math.hypot(x - x1 - t * dx, y - y1 - t * dy) < .55) return true; } return false; };
  const rings = [1, .5].map(f => values.map((_, i) => pt(i, f)));
  let r = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cx = x + .5, cy = y + .5;
    if (inside(cx, cy, poly)) r += `<rect x="${x}" y="${y}" width="1" height="1" style="fill:var(--gold);opacity:${onEdge(cx, cy, poly) ? .95 : .38}"/>`;
    else if (rings.some(P => onEdge(cx, cy, P))) r += `<rect x="${x}" y="${y}" width="1" height="1" style="fill:var(--line)"/>`;
  }
  poly.forEach(([x, y], i) => { r += `<rect x="${Math.round(x) - 1}" y="${Math.round(y) - 1}" width="2" height="2" style="fill:var(${colors[i]})"/>`; });
  return `<svg class="radar-svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" role="img" aria-label="${opt.label || 'Radar chart'}">${r}</svg>`;
}
/* where to place labels around the radar, as % of its box */
export function radarLabelPos(i, k) {
  const a = -Math.PI / 2 + i * 2 * Math.PI / k;
  return { left: 50 + Math.cos(a) * 50, top: 50 + Math.sin(a) * 50 };
}
