# The intro's models (src/boot.js), all in one file, each under an empty named for it so the intro can place and
# animate it on its own:
#   gpu    a two-fan card in the 2080 Ti's proportions, no branding: shroud with the fan openings cut out, the fans as
#          their own objects (fan_L, fan_R, spun by the intro), fin stack, copper pipes, board with gold PCIe fingers
#          (fingers, lit by the intro), backplate, bracket, sockets, a light strip (glow)
#   chip   a GPU package: substrate, a mirror-dark die with lit traces, capacitors round it
#   dimm   a memory stick: board, memory chips both sides, gold contacts, a light strip
#   net    a small neural network: four layers of glowing nodes (net_n0..net_n3, pulsed in turn) and the links between
#   attn   an attention pattern as a city of columns: causal (lower triangle), each column as tall as its weight
#   watch  a stopwatch: body, face, ticks, the hand (watch_hand, swept by the intro), crown
#   gauge  a speed gauge: dial, a cyan-to-orange arc of ticks, the needle (gauge_needle, swung by the intro)
#   blender -b --factory-startup --python tools/build_intro.py
# writes public/intro/intro.glb and assets/intro_preview.png.
# Blender axes: z up, every model faces -y (glTF turns -y into +z, toward a camera looking down -z).
import bpy, bmesh, math, os
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)


def mat(name, col, metal=0.0, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m


M = {
    'shroud': mat('shroud', (0.035, 0.04, 0.045), 0.6, 0.38),
    'trim': mat('trim', (0.12, 0.13, 0.14), 0.85, 0.25),
    'fan': mat('fan', (0.02, 0.022, 0.025), 0.1, 0.55),
    'hub': mat('hub', (0.05, 0.05, 0.055), 0.7, 0.3),
    'fins': mat('fins', (0.55, 0.57, 0.6), 1.0, 0.32),
    'copper': mat('copper', (0.85, 0.42, 0.22), 1.0, 0.25),
    'pcb': mat('pcb', (0.015, 0.03, 0.025), 0.0, 0.6),
    'gold': mat('gold', (1.0, 0.72, 0.3), 1.0, 0.2, (1.0, 0.55, 0.2), 0.0),
    'back': mat('back', (0.06, 0.065, 0.07), 0.9, 0.35),
    'bracket': mat('bracket', (0.6, 0.62, 0.64), 1.0, 0.3),
    'socket': mat('socket', (0.015, 0.015, 0.015), 0.0, 0.7),
    'glow': mat('glow', (1.0, 0.45, 0.12), 0.0, 0.4, (1.0, 0.45, 0.12), 6.0),
    'ring': mat('ring', (1.0, 0.45, 0.12), 0.0, 0.4, (1.0, 0.45, 0.12), 2.5),
    'die': mat('die', (0.02, 0.022, 0.03), 0.9, 0.12),
    'trace': mat('trace', (1.0, 0.5, 0.15), 0.0, 0.4, (1.0, 0.5, 0.15), 3.0),
    'cap': mat('cap', (0.55, 0.45, 0.3), 0.6, 0.35),
    'substrate': mat('substrate', (0.03, 0.06, 0.05), 0.2, 0.5),
    'ic': mat('ic', (0.01, 0.01, 0.012), 0.2, 0.45),
    'node': mat('node', (1.0, 0.5, 0.18), 0.0, 0.3, (1.0, 0.5, 0.18), 4.0),
    'edge': mat('edge', (0.37, 0.82, 0.75), 0.0, 0.4, (0.37, 0.82, 0.75), 1.2),
    'column': mat('column', (0.07, 0.08, 0.085), 0.8, 0.3),
    'colcap': mat('colcap', (1.0, 0.5, 0.18), 0.0, 0.4, (1.0, 0.5, 0.18), 3.5),
    'body': mat('body', (0.08, 0.085, 0.09), 0.9, 0.22),
    'face': mat('face', (0.02, 0.025, 0.025), 0.1, 0.6),
    'tick': mat('tick', (0.85, 0.9, 0.88), 0.0, 0.5, (0.85, 0.9, 0.88), 1.0),
    'hand': mat('hand', (1.0, 0.5, 0.18), 0.0, 0.4, (1.0, 0.5, 0.18), 5.0),
    'arc_cool': mat('arc_cool', (0.37, 0.82, 0.75), 0.0, 0.4, (0.37, 0.82, 0.75), 2.5),
}
FANS = {'fan_L': (-0.62, 0.05), 'fan_R': (0.55, 0.05)}       # x, z of each fan's centre
R_FAN = 0.43


def obj(name, bm, material, origin=(0, 0, 0)):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(M[material])
    o = bpy.data.objects.new(name, me); o.location = origin; bpy.context.scene.collection.objects.link(o); return o


def group(name, objs, loc):
    """an empty named for a model, its pieces (built about the origin) parented to it"""
    e = bpy.data.objects.new(name, None); e.location = loc; bpy.context.scene.collection.objects.link(e)
    for o in objs: o.parent = e
    return e


def sphere(bm, r, loc, segs=16, rings=8):
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r, matrix=Matrix.Translation(loc))


def cube(bm, size, loc, rot=(0, 0, 0)):
    T = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X') @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=T)


def cyl(bm, r, depth, loc, segs=48, axis='Y', r2=None):
    rot = Matrix.Rotation(math.pi / 2, 4, 'X') if axis == 'Y' else Matrix.Rotation(math.pi / 2, 4, 'Y') if axis == 'X' else Matrix.Identity(4)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=depth, matrix=Matrix.Translation(loc) @ rot)


# the shroud: a plate with the two fan openings cut out, chamfered accent ribs, and trim along the edges
bm = bmesh.new(); cube(bm, (2.72, 0.13, 1.16), (0, -0.2, 0.05)); shroud = obj('shroud', bm, 'shroud')
for n, (x, z) in FANS.items():
    bm = bmesh.new(); cyl(bm, R_FAN + 0.02, 0.6, (x, -0.2, z), 64); cut = obj('cut_' + n, bm, 'shroud')
    mod = shroud.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut
    bpy.context.view_layer.objects.active = shroud; bpy.ops.object.modifier_apply(modifier='cut'); bpy.data.objects.remove(cut, do_unlink=True)
bm = bmesh.new()
for s in (-1, 1):
    cube(bm, (2.72, 0.05, 0.035), (0, -0.28, 0.05 + s * 0.6))                                   # top and bottom trim
    for k in range(3): cube(bm, (0.32, 0.04, 0.025), (-0.06 + s * 0.02, -0.285, 0.05 + s * (0.26 + k * 0.07)), (0, s * 0.5, 0))  # ribs between the fans
cube(bm, (0.05, 0.05, 1.2), (1.37, -0.28, 0.05)); cube(bm, (0.05, 0.05, 1.2), (-1.37, -0.28, 0.05))
obj('trim', bm, 'trim')
# a lit ring round each opening
for n, (x, z) in FANS.items():
    bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=False, segments=72, radius=R_FAN + 0.025)
    ring = bmesh.new(); bmesh.ops.create_cone(ring, cap_ends=False, segments=72, radius1=R_FAN + 0.035, radius2=R_FAN + 0.035, depth=0.012, matrix=Matrix.Translation((x, -0.268, z)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    bm.free(); obj('ring_' + n, ring, 'ring')

def blade(bm, a, r0=0.135, r1=0.415, n=9):
    """one fan blade about the y axis at angle a: a curved strip from the hub out, swept back and widening, pitched
    (its leading edge forward of its trailing edge), with a little thickness"""
    rows = []
    for i in range(n + 1):
        u = i / n; r = r0 + (r1 - r0) * u
        half = (0.05 + 0.05 * u) / r                              # half the chord, as an angle
        mid = a + 0.55 * u * u                                      # swept back toward the tip
        row = []
        for side, pitch in ((-1, 0.028), (1, -0.028)):
            th = mid + side * half
            for dy in (0.0, 0.007):
                row.append(bm.verts.new((math.cos(th) * r, pitch + dy, math.sin(th) * r)))
        rows.append(row)                                           # [lead, lead back, trail, trail back]
    for A, B in zip(rows, rows[1:]):
        for p, q in ((0, 2), (1, 3), (0, 1), (2, 3)):
            bm.faces.new((A[p], A[q], B[q], B[p]) if p in (0,) or (p, q) == (2, 3) else (A[q], A[p], B[p], B[q]))
    for R in (rows[0], rows[-1]): bm.faces.new((R[0], R[1], R[3], R[2]))


# the fans: hub and thirteen swept blades, built about the fan's centre so they spin in place
for n, (x, z) in FANS.items():
    bm = bmesh.new(); cyl(bm, 0.13, 0.08, (0, 0, 0), 40)
    for k in range(13):
        blade(bm, k * math.tau / 13)
    obj(n, bm, 'fan', (x, -0.17, z))
    bm = bmesh.new(); cyl(bm, 0.06, 0.02, (0, -0.045, 0), 32); obj(n + '_cap', bm, 'hub', (x, -0.17, z))

# behind the fans: the fin stack, the copper heat pipes looping over it
bm = bmesh.new()
for i in range(86):
    cube(bm, (0.009, 0.15, 1.0), (-1.3 + i * 0.031, -0.05, 0.05))
obj('fins', bm, 'fins')
bm = bmesh.new()
for k, z in enumerate((0.42, 0.34, -0.26, -0.34)):
    cyl(bm, 0.022, 2.5, (0.02, -0.05 + (k % 2) * 0.04, z), 16, 'X')
    cyl(bm, 0.022, 0.3, (1.27, -0.05 + (k % 2) * 0.04, z * 0.6), 16, 'Z')
obj('pipes', bm, 'copper')

# the board, its gold fingers, the backplate, the bracket, the power sockets
bm = bmesh.new(); cube(bm, (2.66, 0.035, 1.12), (0.0, 0.05, 0.02))
for i in range(14): cube(bm, (0.04, 0.02, 0.05), (1.2 - i * 0.07, 0.025, 0.55))          # little components along the top
obj('pcb', bm, 'pcb')
bm = bmesh.new()
for i in range(36):
    if i == 9: continue                                                                     # the key notch
    cube(bm, (0.022, 0.04, 0.09), (-0.8 + i * 0.034, 0.05, -0.58))
obj('fingers', bm, 'gold')
bm = bmesh.new(); cube(bm, (2.7, 0.03, 1.14), (0, 0.1, 0.04))
for i in range(12): cube(bm, (0.12, 0.012, 0.018), (0.6 + (i % 4) * 0.16, 0.085, 0.3 - (i // 4) * 0.06))
obj('backplate', bm, 'back')
bm = bmesh.new(); cube(bm, (0.03, 0.42, 1.4), (-1.43, -0.06, 0.12))
for i in range(6): cube(bm, (0.035, 0.05, 0.12), (-1.43, -0.18 + (i % 2) * 0.16, 0.5 - (i // 2) * 0.22))
obj('bracket', bm, 'bracket')
bm = bmesh.new()
for x in (0.75, 1.0): cube(bm, (0.2, 0.1, 0.08), (x, 0.02, 0.62))
obj('sockets', bm, 'socket')
# the light strip along the top edge
bm = bmesh.new(); cube(bm, (2.3, 0.02, 0.025), (0.05, -0.29, 0.66)); obj('glow', bm, 'glow')

group('gpu', [o for o in bpy.context.scene.objects if o.parent is None and o.type == 'MESH'], (0, 0, 0))

# ---------- chip: the package, standing, its die toward -y ----------
parts = []
bm = bmesh.new(); cube(bm, (1.0, 0.06, 1.0), (0, 0, 0)); parts.append(obj('chip_substrate', bm, 'substrate'))
bm = bmesh.new(); cube(bm, (0.56, 0.05, 0.56), (0, -0.05, 0)); parts.append(obj('chip_die', bm, 'die'))
bm = bmesh.new()
for i in range(9):                                                        # traces across the die, both ways
    p = -0.24 + i * 0.06
    cube(bm, (0.48, 0.004, 0.006), (0, -0.077, p)); cube(bm, (0.006, 0.004, 0.48), (p, -0.077, 0))
cube(bm, (0.14, 0.004, 0.14), (0.1, -0.078, -0.08))
parts.append(obj('chip_traces', bm, 'trace'))
bm = bmesh.new()
for k in range(28):                                                        # capacitors round the die
    side, i = divmod(k, 7); p = -0.36 + i * 0.12
    x, z = [(p, 0.42), (0.42, -p), (-p, -0.42), (-0.42, p)][side]
    cube(bm, (0.05, 0.03, 0.025) if side % 2 == 0 else (0.025, 0.03, 0.05), (x, -0.045, z))
parts.append(obj('chip_caps', bm, 'cap'))
group('chip', parts, (4, 0, 0))

# ---------- dimm: a memory stick ----------
parts = []
bm = bmesh.new(); cube(bm, (2.6, 0.03, 0.55), (0, 0, 0)); parts.append(obj('dimm_pcb', bm, 'pcb'))
bm = bmesh.new()
for side in (-1, 1):
    for i in range(8): cube(bm, (0.24, 0.025, 0.2), (-1.08 + i * 0.31, side * 0.028, 0.06))
parts.append(obj('dimm_ics', bm, 'ic'))
bm = bmesh.new()
for i in range(60):
    if i == 27: continue
    cube(bm, (0.026, 0.036, 0.08), (-1.2 + i * 0.041, 0, -0.25))
parts.append(obj('dimm_contacts', bm, 'gold'))
bm = bmesh.new(); cube(bm, (2.4, 0.04, 0.03), (0, -0.01, 0.27)); parts.append(obj('dimm_glow', bm, 'glow'))
group('dimm', parts, (8, 0, 0))

# ---------- net: four layers of nodes, every link between neighbouring layers ----------
parts, layers = [], [4, 6, 6, 3]
pos = [[(-1.2 + li * 0.8, (j % 2) * 0.12 - 0.06, (j - (n - 1) / 2) * 0.36) for j in range(n)] for li, n in enumerate(layers)]
for li, P in enumerate(pos):
    bm = bmesh.new()
    for p in P: sphere(bm, 0.075, p)
    parts.append(obj(f'net_n{li}', bm, 'node'))
bm = bmesh.new()
for A, B in zip(pos, pos[1:]):
    for a in A:
        for b in B:
            va, vb = Vector(a), Vector(b); d = vb - va
            bmesh.ops.create_cone(bm, cap_ends=False, segments=6, radius1=0.006, radius2=0.006, depth=d.length,
                                  matrix=Matrix.Translation((va + vb) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
parts.append(obj('net_edges', bm, 'edge'))
group('net', parts, (12, 0, 0))

# ---------- attn: a causal attention pattern as columns ----------
parts = []
bm, caps = bmesh.new(), bmesh.new()
n = 8
for i in range(n):
    for j in range(i + 1):
        hgt = 0.08 + 0.9 * (1.0 if j == i else 0.75 if j == 0 else 0.15 + 0.45 * abs(math.sin(i * 2.3 + j * 1.7)))
        x, y = -0.6 + j * 0.17, -0.6 + i * 0.17
        cube(bm, (0.13, 0.13, hgt), (x, y, hgt / 2)); cube(caps, (0.13, 0.13, 0.02), (x, y, hgt + 0.01))
parts.append(obj('attn_columns', bm, 'column')); parts.append(obj('attn_caps', caps, 'colcap'))
group('attn', parts, (16, 0, 0))

# ---------- watch: a stopwatch ----------
parts = []
bm = bmesh.new(); cyl(bm, 0.62, 0.16, (0, 0, 0), 64); parts.append(obj('watch_body', bm, 'body'))
bm = bmesh.new(); cyl(bm, 0.54, 0.02, (0, -0.085, 0), 64); parts.append(obj('watch_face', bm, 'face'))
bm = bmesh.new()
for k in range(60):
    a = k * math.tau / 60; big = k % 5 == 0; r = 0.47
    cube(bm, (0.022 if big else 0.012, 0.01, 0.08 if big else 0.04), (math.sin(a) * r, -0.098, math.cos(a) * r), (0, a, 0))
parts.append(obj('watch_ticks', bm, 'tick'))
bm = bmesh.new(); cube(bm, (0.018, 0.012, 0.46), (0, 0, 0.18)); cyl(bm, 0.035, 0.02, (0, 0, 0), 24)
parts.append(obj('watch_hand', bm, 'hand', (0, -0.11, 0)))
bm = bmesh.new(); cyl(bm, 0.07, 0.14, (0, 0, 0.7), 24, 'Z'); cyl(bm, 0.1, 0.06, (0, 0, 0.8), 24, 'Z'); cube(bm, (0.08, 0.06, 0.1), (0.42, 0, 0.5), (0, -0.7, 0))
parts.append(obj('watch_crown', bm, 'body'))
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=64, radius1=0.6, radius2=0.6, depth=0.02, matrix=Matrix.Translation((0, -0.09, 0)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
parts.append(obj('watch_ring', bm, 'ring'))
group('watch', parts, (20, 0, 0))

# ---------- gauge: a speed gauge, its arc running cyan to orange ----------
parts = []
bm = bmesh.new(); cyl(bm, 0.7, 0.1, (0, 0, 0), 64); parts.append(obj('gauge_body', bm, 'body'))
bm = bmesh.new(); cyl(bm, 0.64, 0.02, (0, -0.055, 0), 64); parts.append(obj('gauge_face', bm, 'face'))
cool, hot = bmesh.new(), bmesh.new()
for k in range(41):
    a = math.radians(-120 + k * 6); big = k % 5 == 0; r = 0.55
    cube(cool if k < 28 else hot, (0.018, 0.01, 0.1 if big else 0.06), (math.sin(a) * r, -0.07, math.cos(a) * r), (0, a, 0))
parts.append(obj('gauge_cool', cool, 'arc_cool')); parts.append(obj('gauge_hot', hot, 'glow'))
bm = bmesh.new(); cube(bm, (0.022, 0.014, 0.5), (0, 0, 0.21)); cyl(bm, 0.06, 0.03, (0, 0, 0), 24)
parts.append(obj('gauge_needle', bm, 'hand', (0, -0.085, 0)))
group('gauge', parts, (24, 0, 0))

# finish: bevel the edges so they catch the light like machined parts, and shade the round things smooth
BEVEL = {'shroud': 0.012, 'trim': 0.006, 'backplate': 0.006, 'bracket': 0.004, 'pcb': 0.003, 'sockets': 0.006,
         'chip_substrate': 0.01, 'chip_die': 0.008, 'chip_caps': 0.004, 'dimm_pcb': 0.004, 'dimm_ics': 0.006,
         'attn_columns': 0.012, 'watch_body': 0.02, 'watch_crown': 0.008, 'gauge_body': 0.02, 'fan_L_cap': 0.006, 'fan_R_cap': 0.006}
SMOOTH = {'watch_body', 'watch_face', 'watch_ring', 'gauge_body', 'gauge_face', 'net_n0', 'net_n1', 'net_n2', 'net_n3', 'pipes',
          'fan_L_cap', 'fan_R_cap', 'ring_fan_L', 'ring_fan_R', 'watch_crown'}
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH': continue
    if o.name in BEVEL:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = BEVEL[o.name]; m.segments = 2; m.limit_method = 'ANGLE'; m.harden_normals = True
    if o.name in BEVEL or o.name in SMOOTH:
        for p in o.data.polygons: p.use_smooth = True
    if o.name in SMOOTH and o.name not in BEVEL:
        m = o.modifiers.new('smooth', 'WEIGHTED_NORMAL'); m.keep_sharp = True

# out
os.makedirs(os.path.join(ROOT, 'public', 'intro'), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, 'public', 'intro', 'intro.glb'), export_apply=True)

# a preview render
sc = bpy.context.scene
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.lens = 24; cam.location = (12, -16, 3.5); sc.collection.objects.link(cam)
cam.rotation_euler = (Vector((12, 0, 0.2)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
for loc, e, col in (((4, -6, 5), 4000, (1, 0.6, 0.35)), ((20, -5, 3), 3000, (0.4, 0.8, 0.75)), ((12, -8, -1), 1200, (1, 1, 1))):
    L = bpy.data.objects.new('lamp', bpy.data.lights.new('lamp', 'AREA')); L.data.energy = e; L.data.size = 6; L.data.color = col; L.location = loc
    L.rotation_euler = (Vector((12, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); sc.collection.objects.link(L)
sc.world = sc.world or bpy.data.worlds.new('w'); sc.world.use_nodes = True
sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.005, 0.008, 0.007, 1)
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 1600, 600
sc.render.filepath = os.path.join(ROOT, 'assets', 'intro_preview.png')
bpy.ops.render.render(write_still=True)
print('wrote', os.path.getsize(os.path.join(ROOT, 'public', 'intro', 'intro.glb')), 'bytes')
