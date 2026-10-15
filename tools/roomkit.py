# What the generated rooms share (tools/build_lab.py, tools/build_apartment.py): materials, boxes merged into one
# mesh per material, the furniture both rooms have, and writing the scene out (GLBs, a preview render, the .blend).
# Blender axes: x across the room, y towards the back wall, z up. Every piece of furniture faces +x in its frame.
import bpy, bmesh, math, os
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meshes = {}                                    # one mesh per material, as the rooms are drawn


def material(prefix, name, col, rough, emit=None, strength=0.0):
    m = bpy.data.materials.get(prefix + name) or bpy.data.materials.new(prefix + name)
    try: m.use_nodes = True
    except Exception: pass
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Emission Color'].default_value = (*(emit or (1, 1, 1)), 1)
    b.inputs['Emission Strength'].default_value = strength
    return m


def box(mat, size, loc, rot=(0, 0, 0), M=None, into=None):
    bm = meshes.setdefault(into or mat, (bmesh.new(), mat))[0]
    T = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X') @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=(M @ T) if M else T)


def at(x, y, yaw=0.0, z=0.0):
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(yaw, 4, 'Z')


def star_base(M):
    for k in range(5):
        a = k * math.tau / 5
        box('dark', (0.3, 0.045, 0.03), (0.15 * math.cos(a), 0.15 * math.sin(a), 0.07), (0, 0, a), M)
        box('dark', (0.05, 0.05, 0.05), (0.29 * math.cos(a), 0.29 * math.sin(a), 0.025), (0, 0, a), M)
    box('metal', (0.045, 0.045, 0.32), (0, 0, 0.23), M=M)


def chair_mesh(M):
    star_base(M)
    box('chair_mesh', (0.5, 0.5, 0.07), (0, 0, 0.42), M=M)
    box('chair_mesh', (0.04, 0.48, 0.62), (-0.27, 0, 0.82), (0, -0.12, 0), M)
    box('dark', (0.03, 0.05, 0.14), (-0.32, 0, 1.17), M=M)
    box('chair_mesh', (0.05, 0.3, 0.16), (-0.31, 0, 1.28), (0, -0.1, 0), M)
    for s in (-1, 1):
        box('dark', (0.04, 0.04, 0.2), (0.0, s * 0.27, 0.55), M=M)
        box('dark', (0.26, 0.07, 0.03), (0.02, s * 0.27, 0.66), M=M)


def monitor(M, w=0.6, h=0.355, zc=0.38, screen='screen_light', into=None):
    box('dark', (0.2, 0.24, 0.012), (-0.07, 0, 0.006), M=M)
    box('dark', (0.03, 0.06, zc), (-0.07, 0, zc / 2), M=M)
    box('dark', (0.03, w + 0.03, h + 0.03), (-0.019, 0, zc), M=M)
    box(screen, (0.004, w, h), (-0.002, 0, zc), M=M, into=into)


def finish(scene, name, prefix, mats, build, empties, preview):
    """Clear the scene, build it, export public/rooms/<name>.glb and assets/<name>.glb, render
    assets/<name>_preview.png, save the .blend. mats: {name: (colour, roughness[, emission colour, strength])};
    empties: {name: location}; preview: (lens, camera location, look-at point, [lamp locations], lamp energy, lamp size)."""
    sc = bpy.data.scenes.get(scene) or bpy.data.scenes.new(scene)
    for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)
    built = {n: material(prefix, n, *v) for n, v in mats.items()}
    meshes.clear(); build()
    for mname, (bm, mat) in meshes.items():
        me = bpy.data.meshes.new(mname); bm.to_mesh(me); bm.free(); me.materials.append(built[mat])
        sc.collection.objects.link(bpy.data.objects.new(mname if mname[0].isupper() else f'm_{prefix}{mname}', me))
    for ename, loc in empties.items():
        e = bpy.data.objects.new(ename, None); e.location = loc; e.empty_display_size = 0.2; sc.collection.objects.link(e)
    for m in list(bpy.data.materials):
        if m.name.startswith(prefix) and m.users == 0: bpy.data.materials.remove(m)
    bpy.context.window.scene = sc
    for out in (f'public/rooms/{name}.glb', f'assets/{name}.glb'):
        bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, out), use_active_scene=True, export_apply=True)
    # the preview; its camera and lamps stay out of the saved scene
    lens, cam_at, look, lamps, energy, size = preview
    tmp = []
    cam = bpy.data.objects.new('preview_cam', bpy.data.cameras.new('preview_cam')); cam.data.lens = lens; cam.location = cam_at
    cam.rotation_euler = (Vector(look) - cam.location).to_track_quat('-Z', 'Y').to_euler(); tmp.append(cam)
    for loc in lamps:
        l = bpy.data.objects.new('preview_lamp', bpy.data.lights.new('preview_lamp', 'POINT')); l.data.energy = energy; l.data.shadow_soft_size = size; l.location = loc; tmp.append(l)
    for o in tmp: sc.collection.objects.link(o)
    sc.camera = cam; sc.render.resolution_x, sc.render.resolution_y = 1280, 960; sc.render.filepath = os.path.join(ROOT, f'assets/{name}_preview.png')
    bpy.ops.render.render(write_still=True, scene=sc.name)
    for o in tmp: bpy.data.objects.remove(o, do_unlink=True)
    sc.camera = None; sc.render.resolution_x, sc.render.resolution_y = 960, 600
    bpy.ops.wm.save_mainfile()
