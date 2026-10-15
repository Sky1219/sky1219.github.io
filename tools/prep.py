# Builds public/data/site.json (footprints + roads in local metres) and src/campus-plan.svg (hero map)
# from the CTF map's OpenStreetMap extracts. Local frame: x east, z south, origin = campus3d.json origin.
#   python tools/prep.py <path to the CTF repo's public/map/data>     both files
#   python tools/prep.py --plan                                        the hero map again, from site.json
import json, math, re, sys
PLACES = ('ECSS', 'ECSW', 'CH6')               # the buildings the tours go to: lit orange on the plan


def read(SRC):
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
        # housing has no code in the map, only "(CH6)" on the end of its name
        name, code = p.get('name') or '', p.get('code') or ''
        m = re.search(r'\s*\((\w{2,5})\)$', name)
        if m and not code: code, name = m.group(1), name[:m.start()]
        feet.append({'id': i, 'code': code, 'name': name, 'h': p.get('height') or 10,
                     'model': bool(man['owners'][i]), 'rings': [[c for xz in r for c in xz] for r in rings]})
    R = json.load(open(f'{SRC}/roads.geojson'))
    roads = {'major': [], 'service': [], 'path': []}
    for f in R['features']:
        pts = [loc(q) for q in f['geometry']['coordinates']]
        if not any(abs(x) < LIM and abs(z) < LIM for x, z in pts): continue
        roads[f['properties']['class']].append([round(c) for xz in pts for c in xz])
    return {'origin': O, 'footprints': feet, 'roads': roads}


# hero plan: campus from the core down to the apartments, footprints as ink outlines, roads as hairlines.
# A 1200 m box drawn into a 1000-unit viewBox (the pins in index.html use the same units).
X0, Z0, SIZE, VB = -1095, -343, 1200, 1000
def plan(site):
    feet, roads = site['footprints'], site['roads']
    k = VB / SIZE
    def path(flat):
        pts = [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]
        return 'M' + 'L'.join(f'{(x - X0) * k:.0f},{(z - Z0) * k:.0f}' for x, z in pts)
    inside = lambda flat: any(X0 - 50 < flat[i] < X0 + SIZE + 50 and Z0 - 50 < flat[i + 1] < Z0 + SIZE + 50 for i in range(0, len(flat), 2))
    rd = ' '.join(path(r) for kind in ('major', 'service') for r in roads[kind] if inside(r))
    bd = ' '.join(path(r) + 'Z' for f in feet for r in f['rings'] if inside(r) and f['code'] not in PLACES)
    hot = ''.join(f'<path class="plan-hot" data-code="{c}" d="{" ".join(path(r) + "Z" for f in feet if f["code"] == c for r in f["rings"])}"/>' for c in PLACES)
    svg = (f'<svg class="plan-art" viewBox="0 0 {VB} {VB}" aria-hidden="true">'
           f'<path class="plan-roads" d="{rd}"/><path class="plan-buildings" d="{bd}"/>{hot}</svg>')
    open('src/campus-plan.svg', 'w').write(svg)
    cent = {f['code']: (sum(f['rings'][0][0::2]) / (len(f['rings'][0]) / 2), sum(f['rings'][0][1::2]) / (len(f['rings'][0]) / 2)) for f in feet if f['code'] in PLACES}
    print('plan centres (viewBox units)', {c: [round((x - X0) * k), round((z - Z0) * k)] for c, (x, z) in cent.items()})


if sys.argv[1] == '--plan':
    plan(json.load(open('public/data/site.json')))
else:
    site = read(sys.argv[1])
    json.dump(site, open('public/data/site.json', 'w'), separators=(',', ':'))
    plan(site)
