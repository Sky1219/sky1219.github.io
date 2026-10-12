# Builds public/data/site.json (footprints + roads in local metres) and src/campus-plan.svg (hero map)
# from the CTF map's OpenStreetMap extracts. Local frame: x east, z south, origin = campus3d.json origin.
import json, math, sys
SRC = sys.argv[1]
man = json.load(open(f'{SRC}/campus3d.json'))
O = man['origin']; KX = 111320 * math.cos(math.radians(32.9872)); KY = 110540
loc = lambda p: (round((p[0] - O[0]) * KX, 1), round(-(p[1] - O[1]) * KY, 1))
LIM = 1400
B = json.load(open(f'{SRC}/buildings.geojson'))
feet = []
for i, f in enumerate(B['features']):
    g = f['geometry']; polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    p = f['properties']
    rings = [[loc(q) for q in poly[0]] for poly in polys]
    if not any(abs(x) < LIM and abs(z) < LIM for r in rings for x, z in r): continue
    feet.append({'id': i, 'code': p.get('code') or '', 'name': p.get('name') or '', 'h': p.get('height') or 10,
                 'model': bool(man['owners'][i]), 'rings': [[c for xz in r for c in xz] for r in rings]})
R = json.load(open(f'{SRC}/roads.geojson'))
roads = {'major': [], 'service': [], 'path': []}
for f in R['features']:
    pts = [loc(q) for q in f['geometry']['coordinates']]
    if not any(abs(x) < LIM and abs(z) < LIM for x, z in pts): continue
    roads[f['properties']['class']].append([round(c) for xz in pts for c in xz])
json.dump({'origin': O, 'footprints': feet, 'roads': roads}, open('public/data/site.json', 'w'), separators=(',', ':'))
# hero plan: the campus core, footprints as ink outlines, roads as hairlines
X0, X1, Z0, Z1 = -800, 200, -560, 440
def path(flat):
    pts = [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]
    return 'M' + 'L'.join(f'{x - X0:.0f},{z - Z0:.0f}' for x, z in pts)
inside = lambda flat: any(X0 - 50 < flat[i] < X1 + 50 and Z0 - 50 < flat[i + 1] < Z1 + 50 for i in range(0, len(flat), 2))
rd = ' '.join(path(r) for k in ('major', 'service') for r in roads[k] if inside(r))
bd = ' '.join(path(r) + 'Z' for f in feet for r in f['rings'] if inside(r) and f['code'] not in ('ECSS', 'ECSW'))
hot = ' '.join(path(r) + 'Z' for f in feet for r in f['rings'] if f['code'] in ('ECSS', 'ECSW'))
svg = (f'<svg class="plan-art" viewBox="0 0 {X1 - X0} {Z1 - Z0}" aria-hidden="true">'
       f'<path class="plan-roads" d="{rd}"/><path class="plan-buildings" d="{bd}"/><path class="plan-hot" d="{hot}"/></svg>')
open('src/campus-plan.svg', 'w').write(svg)
cent = {f['code']: [round(sum(f['rings'][0][0::2]) / (len(f['rings'][0]) / 2)), round(sum(f['rings'][0][1::2]) / (len(f['rings'][0]) / 2))] for f in feet if f['code'] in ('ECSS', 'ECSW', 'ECSN')}
print('plan box', X0, Z0, 'centres', {k: [v[0] - X0, v[1] - Z0] for k, v in cent.items()})
