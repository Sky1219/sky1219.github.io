# Builds the two labmates who were in the photo the lab is modelled on, in the same form as my avatar: one mesh
# per body part, named after the rig's parts in src/tour/people.js (here with a prefix, p1_ and p2_), so the
# site's poses drive them.
#   blender -b --factory-startup --python tools/build_labmates.py
# Writes public/rooms/labmates.glb, assets/labmates.blend and assets/labmates_preview*.png (each posed in the lab).
# Each part is drawn in its own frame: x to the figure's left, -y forward, z up, origin at the rig's marker.
import bpy, bmesh, math, os
from mathutils import Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATS = {
    'white': (0.88, 0.87, 0.83), 'skin_a': (0.27, 0.155, 0.095), 'skin_b': (0.78, 0.56, 0.42), 'hair': (0.02, 0.018, 0.016),
    'cream': (0.86, 0.8, 0.64), 'navy': (0.05, 0.08, 0.28), 'khaki': (0.62, 0.47, 0.29), 'sneaker': (0.5, 0.51, 0.53),
    'sole': (0.9, 0.9, 0.88), 'slide': (0.03, 0.03, 0.035), 'frame': (0.8, 0.8, 0.78), 'lens': (0.45, 0.6, 0.75),
    'marker': (0.05, 0.1, 0.5),
}
# where each part's marker sits on the standing rig (people.js makeRig), in Blender axes
ORIGIN = {'head': (0, 0, 1.67), 'torso': (0, 0, 1.26), 'hips': (0, 0, 0.92), 'uarm': (0.28, 0, 1.32), 'farm': (0.28, 0, 1.03),
          'thigh': (0.1, 0, 0.64), 'shin': (0.1, 0, 0.25), 'foot': (0.1, -0.05, 0.04)}


def limbs(P, s, skin, sleeve, band, thigh, shin, foot):
    """the parts that come in pairs; s is +1 for the left side, -1 for the right"""
    L = 'L' if s > 0 else 'R'
    top = sleeve[1]                                            # how far down the upper arm the sleeve comes
    P['uarm' + L] = [(sleeve[0], (0.145, 0.15, 0.15 - top), (0, 0, (0.15 + top) / 2))] + \
        ([(band, (0.15, 0.155, 0.035), (0, 0, top - 0.0175))] if band else []) + \
        [(skin, (0.11, 0.115, top + 0.15 - (0.035 if band else 0)), (0, 0, (top - (0.035 if band else 0) - 0.15) / 2))]
    P['farm' + L] = [(skin, (0.1, 0.105, 0.3), (0, 0, 0)), (skin, (0.085, 0.12, 0.08), (0, -0.01, -0.19))]
    P['thigh' + L], P['shin' + L], P['foot' + L] = thigh, shin, foot


def coder():
    """white tee, white shorts, white socks, black slides, glasses, short hair; writing code at the desk under the posters"""
    P = {
        'head': [('skin_a', (0.235, 0.25, 0.27), (0, 0, 0)), ('hair', (0.243, 0.256, 0.028), (0, 0.003, 0.137)), ('hair', (0.243, 0.025, 0.12), (0, 0.118, 0.07)),
                 ('hair', (0.012, 0.15, 0.06), (0.118, 0.05, 0.095)), ('hair', (0.012, 0.15, 0.06), (-0.118, 0.05, 0.095)),
                 ('lens', (0.085, 0.012, 0.05), (0.055, -0.128, 0.03)), ('lens', (0.085, 0.012, 0.05), (-0.055, -0.128, 0.03)),
                 ('frame', (0.215, 0.014, 0.014), (0, -0.129, 0.058)), ('frame', (0.03, 0.014, 0.02), (0, -0.129, 0.035)),
                 ('frame', (0.012, 0.14, 0.014), (0.121, -0.06, 0.05)), ('frame', (0.012, 0.14, 0.014), (-0.121, -0.06, 0.05))],
        'torso': [('white', (0.41, 0.24, 0.5), (0, 0, 0)), ('skin_a', (0.12, 0.12, 0.08), (0, 0, 0.27)), ('white', (0.2, 0.2, 0.025), (0, 0, 0.255))],
        'hips': [('white', (0.385, 0.235, 0.17), (0, 0, 0))],
    }
    for s in (1, -1):
        limbs(P, s, 'skin_a', ('white', -0.02), None,
              [('white', (0.175, 0.185, 0.27), (0, 0, 0.065)), ('skin_a', (0.14, 0.15, 0.13), (0, 0, -0.135))],
              [('skin_a', (0.125, 0.135, 0.25), (0, 0, 0.065)), ('white', (0.135, 0.145, 0.13), (0, 0, -0.125))],
              [('white', (0.12, 0.2, 0.07), (0, 0.035, 0.005)), ('slide', (0.15, 0.28, 0.025), (0, 0, -0.035)), ('slide', (0.156, 0.1, 0.062), (0, -0.06, 0.004))])
    return P


def board_guy():
    """cream tee with a navy band on the sleeve, khaki trousers, grey sneakers, fuller black hair; at the whiteboard"""
    P = {
        'head': [('skin_b', (0.235, 0.25, 0.27), (0, 0, 0)), ('hair', (0.27, 0.29, 0.09), (0, 0.005, 0.135)), ('hair', (0.27, 0.07, 0.25), (0, 0.125, 0.01)),
                 ('hair', (0.03, 0.2, 0.15), (0.125, 0.04, 0.06)), ('hair', (0.03, 0.2, 0.15), (-0.125, 0.04, 0.06)), ('hair', (0.26, 0.04, 0.07), (0, -0.125, 0.11))],
        'torso': [('cream', (0.42, 0.245, 0.5), (0, 0, 0)), ('skin_b', (0.12, 0.12, 0.08), (0, 0, 0.27)), ('cream', (0.2, 0.2, 0.025), (0, 0, 0.255))],
        'hips': [('khaki', (0.385, 0.235, 0.17), (0, 0, 0)), ('cream', (0.425, 0.25, 0.05), (0, 0, 0.07))],
    }
    for s in (1, -1):
        limbs(P, s, 'skin_b', ('cream', 0.0), 'navy',
              [('khaki', (0.165, 0.175, 0.4), (0, 0, 0))], [('khaki', (0.15, 0.16, 0.38), (0, 0, 0))],
              [('sneaker', (0.15, 0.28, 0.075), (0, 0, 0.005)), ('sole', (0.158, 0.29, 0.028), (0, 0, -0.036)), ('sole', (0.152, 0.07, 0.04), (0, -0.11, 0.0)),
               ('navy', (0.154, 0.06, 0.05), (0, 0.11, 0.01))])
    P['farmR'] += [('marker', (0.022, 0.022, 0.11), (0, -0.02, -0.275))]         # the marker, in his right hand
    return P


def make(prefix, parts, mats, sc, dx):
    objs = {}
    for name, boxes in parts.items():
        used = sorted({b[0] for b in boxes}); bm = bmesh.new()
        for mat, size, loc in boxes:
            r = bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(loc) @ Matrix.Diagonal((*size, 1)))
            for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = used.index(mat)
        me = bpy.data.meshes.new(prefix + name); bm.to_mesh(me); bm.free()
        for m in used: me.materials.append(mats[m])
        o = bpy.data.objects.new(prefix + name, me); sc.collection.objects.link(o)
        base = name.rstrip('LR') if name[-1] in 'LR' and name not in ORIGIN else name
        x, y, z = ORIGIN[base]; o.location = ((x if not name.endswith('R') else -x) + dx, y, z)
        objs[name] = o
    return objs


# ---- the site's rig and poses (people.js), so the preview shows them as the site will. three.js axes: y up, +z forward.
RX = lambda a: Matrix.Rotation(a, 4, 'X'); RY = lambda a: Matrix.Rotation(a, 4, 'Y'); RZ = lambda a: Matrix.Rotation(a, 4, 'Z')
T = lambda x, y, z: Matrix.Translation((x, y, z))
TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def posed(kind, pos, yaw):
    # pelvis height, chest, neck, hip, knee, then (shoulder, elbow) for each arm
    if kind == 'write': py, chest, neck, hip, kn, arms = 0.9, 0, -0.1, 0, 0, {'L': (0.05, -0.15), 'R': (-1.2, -0.9)}
    else: py, chest, neck, hip, kn, arms = 0.52, 0.12, 0.15, -math.pi / 2, math.pi / 2, {'L': (-0.55, -1.0), 'R': (-0.55, -1.0)}
    pelvis = T(*pos) @ RY(yaw) @ T(0, py, 0); ch = pelvis @ T(0, 0.1, 0) @ RX(chest)
    M = {'hips': pelvis @ T(0, 0.02, 0), 'torso': ch @ T(0, 0.26, 0), 'head': ch @ T(0, 0.52, 0) @ RX(neck) @ T(0, 0.15, 0)}
    for s, L in ((1, 'L'), (-1, 'R')):
        shm = ch @ T(s * 0.28, 0.46, 0) @ RX(arms[L][0]); elm = shm @ T(0, -0.29, 0) @ RX(arms[L][1])
        M['uarm' + L], M['farm' + L] = shm @ T(0, -0.14, 0), elm @ T(0, -0.14, 0)
        hm = pelvis @ T(s * 0.1, -0.06, 0) @ RX(hip); km = hm @ T(0, -0.4, 0) @ RX(kn); am = km @ T(0, -0.38, 0)
        M['thigh' + L], M['shin' + L], M['foot' + L] = hm @ T(0, -0.2, 0), km @ T(0, -0.19, 0), am @ T(0, -0.02, 0.05)
    return {k: TO_BLENDER @ m @ TO_BLENDER.inverted() for k, m in M.items()}


def main():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene; sc.name = 'Labmates'
    mats = {}
    for n, col in MATS.items():
        m = bpy.data.materials.new('lm_' + n)
        try: m.use_nodes = True
        except Exception: pass
        b = next(x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED'); b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = 0.7
        if 'glow' in n: b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = 2.0
        mats[n] = m
    p1, p2 = make('p1_', coder(), mats, sc, -0.5), make('p2_', board_guy(), mats, sc, 0.5)
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, 'public/rooms/labmates.glb'), use_active_scene=True, export_apply=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'assets/labmates.blend'))
    # the preview: both in the lab, posed and placed as in src/tour/rooms.js (not saved)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'public/rooms/lab.glb'))
    for objs, kind, pos, yaw in ((p1, 'type', (1.5, 0, -3.3), math.pi), (p2, 'write', (2.52, 0, -1.45), math.pi / 2)):
        for name, m in posed(kind, pos, yaw).items(): objs[name].matrix_world = m
    for x in (-1.6, 1.6):
        for y in (-3, 0, 3):
            l = bpy.data.objects.new('lamp', bpy.data.lights.new('lamp', 'POINT')); l.data.energy = 90; l.data.shadow_soft_size = 0.6; l.location = (x, y, 2.8); sc.collection.objects.link(l)
    sc.render.engine = 'BLENDER_EEVEE'
    for i, (loc, look, lens) in enumerate((((0.3, 1.6, 1.4), (1.6, 3.6, 0.9), 28), ((0.4, -0.3, 1.5), (3.0, 1.7, 1.3), 28))):
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.lens = lens; cam.location = loc; sc.collection.objects.link(cam)
        from mathutils import Vector
        cam.rotation_euler = (Vector(look) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.camera = cam; sc.render.resolution_x, sc.render.resolution_y = 1100, 800
        sc.render.filepath = os.path.join(ROOT, 'assets/labmates_preview.png' if i == 0 else f'assets/labmates_preview_{i}.png')
        bpy.ops.render.render(write_still=True)


main()
