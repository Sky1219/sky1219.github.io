# Rebuilds the Lab scene in assets/rooms.blend after a photo of the real CARAML lab, and exports it:
#   blender -b assets/rooms.blend --python tools/build_lab.py
# Writes public/rooms/lab.glb, assets/lab.glb and assets/lab_preview.png, then saves the .blend.
# Blender axes: x across the room, y towards the back wall, z up. The room is 6.5 x 9.0 x 3.0 m, the door is in
# the front wall, the computer the tour plays on is on the left wall near the back, facing into the room, and
# there is a whiteboard on the right wall.
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roomkit import box, at, star_base, chair_mesh, monitor, finish

W, D, H = 3.25, 4.5, 3.0                      # half width, half depth, height

MATS = {                                       # name: (colour, roughness, emission colour, strength)
    'floor': ((0.66, 0.6, 0.5), 0.35), 'tile_rust': ((0.5, 0.17, 0.07), 0.35), 'tile_black': ((0.035, 0.035, 0.04), 0.3),
    'tile_cream': ((0.84, 0.8, 0.66), 0.35), 'wall': ((0.8, 0.78, 0.65), 0.9), 'ceiling': ((0.82, 0.82, 0.79), 0.9),
    'grid': ((0.6, 0.6, 0.58), 0.7), 'light': ((1, 1, 1), 0.5, (1.0, 0.97, 0.9), 6.0), 'raceway': ((0.55, 0.56, 0.57), 0.6),
    'tray': ((0.86, 0.86, 0.84), 0.5), 'metal': ((0.5, 0.51, 0.53), 0.4), 'dark': ((0.03, 0.03, 0.035), 0.5),
    'desk': ((0.72, 0.64, 0.5), 0.5), 'leg': ((0.6, 0.54, 0.44), 0.6), 'chair_taupe': ((0.3, 0.27, 0.23), 0.9),
    'chair_mesh': ((0.045, 0.045, 0.05), 0.8), 'chair_mauve': ((0.33, 0.27, 0.33), 0.9), 'cabinet': ((0.7, 0.71, 0.7), 0.5),
    'cardboard': ((0.58, 0.43, 0.26), 0.9), 'white': ((0.9, 0.9, 0.88), 0.5), 'paper': ((0.93, 0.93, 0.9), 0.8),
    'poster_orange': ((0.9, 0.38, 0.05), 0.7), 'poster_green': ((0.3, 0.62, 0.12), 0.7), 'poster_ink': ((0.45, 0.5, 0.55), 0.8),
    'screen': ((0.02, 0.05, 0.06), 0.3, (0.15, 0.45, 0.55), 1.2), 'screen_light': ((0.8, 0.82, 0.85), 0.3, (0.8, 0.84, 0.9), 1.0),
    'screen_code': ((0.03, 0.04, 0.07), 0.3, (0.07, 0.12, 0.22), 1.0), 'backpack': ((0.27, 0.28, 0.3), 0.9),
    'yellow': ((0.9, 0.8, 0.3), 0.8), 'door': ((0.4, 0.3, 0.22), 0.6), 'red': ((0.6, 0.1, 0.08), 0.7),
}


# ---------------------------------------------------------------- furniture; every piece faces +x in its own frame
def chair_taupe(M):
    star_base(M)
    box('chair_taupe', (0.46, 0.46, 0.08), (0, 0, 0.42), M=M)
    box('dark', (0.03, 0.07, 0.3), (-0.25, 0, 0.5), M=M)
    box('chair_taupe', (0.07, 0.42, 0.42), (-0.25, 0, 0.8), (0, -0.1, 0), M)


def chair_exec(M):
    star_base(M)
    box('chair_mauve', (0.55, 0.56, 0.14), (0, 0, 0.42), M=M)
    box('chair_mauve', (0.15, 0.56, 0.62), (-0.3, 0, 0.82), (0, -0.14, 0), M)
    for s in (-1, 1):
        box('door', (0.04, 0.05, 0.18), (0.08, s * 0.31, 0.55), M=M)
        box('chair_mauve', (0.4, 0.08, 0.06), (0.0, s * 0.31, 0.66), M=M)


def desk(x0, x1, y0, y1, legs='dark'):
    cx, cy, lx, ly = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    box('desk', (lx, ly, 0.03), (cx, cy, 0.725))
    box('dark', (lx + 0.008, ly + 0.008, 0.012), (cx, cy, 0.706))
    along_x = lx > ly                            # legs at both ends (and the middle of a long run)
    n = 3 if max(lx, ly) > 2.2 else 2
    for k in range(n):
        t = 0.1 + k * (max(lx, ly) - 0.2) / (n - 1)
        px, py = (x0 + t, cy) if along_x else (cx, y0 + t)
        box(legs, (0.05, 0.05, 0.7), (px, py, 0.35))
        box(legs, (0.05, ly - 0.08, 0.03) if along_x else (lx - 0.08, 0.05, 0.03), (px, py, 0.015))


def table(M):                                  # one of the two centre tables: tan top, dark edge, panel legs
    box('desk', (0.76, 1.52, 0.03), (0, 0, 0.735), M=M)
    box('dark', (0.768, 1.528, 0.014), (0, 0, 0.714), M=M)
    for s in (-1, 1):
        box('leg', (0.34, 0.06, 0.7), (0, s * 0.55, 0.36), M=M)
        box('leg', (0.62, 0.07, 0.035), (0, s * 0.55, 0.018), M=M)
    box('dark', (0.06, 0.06, 0.004), (0.2, 0.3, 0.752), M=M)   # cable grommet


def tower(x, y, z=0.0, yaw=0.0):
    box('dark', (0.45, 0.2, 0.42), (0, 0, 0.21), M=at(x, y, yaw, z))


def poster(x0, x1, z0, z1, accent, cols):      # on the back wall: paper, a coloured border and header, blocks of content
    y, cx, w, h = D - 0.006, (x0 + x1) / 2, x1 - x0, z1 - z0
    box(accent, (w, 0.008, h), (cx, y, (z0 + z1) / 2))
    box('paper', (w - 0.04, 0.008, h - 0.14), (cx, y - 0.003, z0 + (h - 0.14) / 2 + 0.02))
    cw = (w - 0.1) / cols
    for c in range(cols):
        for r, (top, ht, m) in enumerate([(0.2, 0.22, 'poster_ink'), (0.46, 0.2, 'screen_light' if c % 2 else 'poster_ink'), (0.7, 0.16, 'poster_ink')]):
            box(m if m != 'screen_light' else 'grid', (cw - 0.04, 0.004, h * ht), (x0 + 0.05 + cw * (c + 0.5), y - 0.008, z1 - h * top - h * ht / 2))


def build():
    # ---- shell
    box('floor', (2 * W, 2 * D, 0.05), (0, 0, -0.025))
    tx, ty = 0.3048, 0.6096                    # accent tiles are one foot by two, scattered on a knight's-move lattice
    nx, ny = int(2 * W / tx), int(2 * D / ty)
    for i in range(nx):
        for j in range(ny):
            if (i + 3 * j) % 5: continue
            c = ('tile_rust', 'tile_black', 'tile_cream')[(i + j) % 3]
            box(c, (tx - 0.004, ty - 0.004, 0.004), (-W + 0.05 + (i + 0.5) * tx, -D + (j + 0.5) * ty, 0.0))
    box('ceiling', (2 * W, 2 * D, 0.05), (0, 0, H + 0.025))
    t = 0.12
    box('wall', (t, 2 * D + 2 * t, H), (-W - t / 2, 0, H / 2)); box('wall', (t, 2 * D + 2 * t, H), (W + t / 2, 0, H / 2))
    box('wall', (2 * W, t, H), (0, D + t / 2, H / 2))
    d0, d1, dh = 0.5, 1.48, 2.16                # the door, in the front wall
    box('wall', (d0 + W, t, H), ((d0 - W) / 2, -D - t / 2, H / 2)); box('wall', (W - d1, t, H), ((W + d1) / 2, -D - t / 2, H / 2))
    box('wall', (d1 - d0, t, H - dh), ((d0 + d1) / 2, -D - t / 2, (H + dh) / 2))
    box('door', (d1 - d0, 0.05, dh), ((d0 + d1) / 2, -D - 0.03, dh / 2)); box('metal', (0.04, 0.06, 0.12), (d1 - 0.1, -D + 0.02, 1.0))
    # the grey wire raceway that runs round the room at desk height
    rz, rh, rt = 1.0, 0.09, 0.03
    box('raceway', (rt, 2 * D, rh), (-W + rt / 2, 0, rz)); box('raceway', (rt, 2 * D, rh), (W - rt / 2, 0, rz))
    box('raceway', (2 * W, rt, rh), (0, D - rt / 2, rz))
    box('raceway', (d0 + W - 0.1, rt, rh), ((d0 - 0.1 - W) / 2, -D + rt / 2, rz)); box('raceway', (W - d1 - 0.1, rt, rh), ((W + d1 + 0.1) / 2, -D + rt / 2, rz))
    for y in (-3.2, -1.4, 0.6, 2.0, 3.6):       # outlets on it
        for s in (-1, 1): box('dark', (0.006, 0.07, 0.04), (s * (W - rt - 0.002), y, rz))
    box('raceway', (0.04, 0.03, H - rz), (-1.12, D - 0.015, (H + rz) / 2))   # the conduit up to the ceiling

    # ---- ceiling: a 2 ft grid, troffers, a vent
    g = 0.6096
    for k in range(-5, 6): box('grid', (0.02, 2 * D, 0.01), ((k + 0.5) * g, 0, H - 0.004))
    for k in range(-7, 8): box('grid', (2 * W, 0.02, 0.01), (0, k * g, H - 0.004))
    for x, y in [(-3 * g, -5 * g), (3 * g, -5 * g), (-3 * g, -g), (3 * g, -g), (-3 * g, 3 * g), (3 * g, 3 * g), (0, -3 * g), (0, 5 * g)]:
        box('light', (g - 0.03, 2 * g - 0.03, 0.02), (x, y, H - 0.012))
        for k in range(1, 6): box('grid', (g - 0.03, 0.012, 0.012), (x, y - g + k * g / 3, H - 0.024))
        for s in (-1, 1): box('grid', (0.012, 2 * g - 0.03, 0.012), (x + s * g / 6, y, H - 0.024))
    for k, s in enumerate((0.56, 0.44, 0.32, 0.2)):
        box('raceway' if k % 2 == 0 else 'ceiling', (s, s, 0.012), (-g, 3.5 * g, H - 0.008 - k * 0.008))

    # ---- the overhead cable tray: a white ladder on threaded rods, a J-hook under every rung
    cx, cz, y0, y1 = 0.5, 2.5, -3.6, 4.0
    for s in (-1, 1): box('tray', (0.03, y1 - y0, 0.07), (cx + s * 0.16, (y0 + y1) / 2, cz))
    n = int((y1 - y0) / 0.28)
    for k in range(n + 1):
        y = y0 + k * (y1 - y0) / n
        box('tray', (0.3, 0.035, 0.025), (cx, y, cz - 0.02))
        box('tray', (0.02, 0.02, 0.13), (cx - 0.19, y, cz - 0.08)); box('tray', (0.07, 0.02, 0.02), (cx - 0.22, y, cz - 0.15))
        box('dark', (0.02, 0.022, 0.035), (cx - 0.25, y, cz - 0.135))
    for y in (-3.2, -1.4, 0.4, 2.2, 3.8):
        for s in (-1, 1): box('metal', (0.012, 0.012, H - cz), (cx + s * 0.16, y, (H + cz) / 2))
    for y in (-2.0, 1.2, 3.0): box('tray', (0.1, 0.14, 0.09), (cx + 0.2, y, cz - 0.02)); box('dark', (0.004, 0.07, 0.04), (cx + 0.252, y, cz - 0.02))

    # ---- left wall: the computer the tour plays on, then two more seats with the mesh chairs
    desk(-W, -2.5, 2.1, 3.85)
    monitor(at(-3.03, 3.0, z=0.74), screen='screen', into='Screen_main')
    box('dark', (0.14, 0.44, 0.02), (-2.72, 3.0, 0.75)); box('dark', (0.1, 0.06, 0.03), (-2.72, 2.66, 0.755))
    tower(-2.95, 3.6, yaw=0.0)
    chair_mesh(at(-1.95, 2.2, 2.6))
    desk(-W, -2.5, -1.2, 1.8)
    for y in (-0.5, 1.0):
        monitor(at(-3.03, y, z=0.74), screen='screen_code'); box('dark', (0.14, 0.44, 0.02), (-2.72, y, 0.75))
    tower(-2.95, 0.25)
    chair_mesh(at(-2.0, 1.05, 2.75)); chair_mesh(at(-1.9, -0.45, -2.6))
    chair_exec(at(-2.35, -2.9, 0.5))
    box('dark', (0.5, 0.3, 0.16), (-1.35, 1.75, 0.08), (0, 0, 0.3))                  # a bag left on the floor

    # ---- the middle: two tables pushed together, the projector, chairs round them
    for s in (-1, 1): table(at(0.3 + s * 0.385, 0.4))
    box('white', (0.3, 0.24, 0.09), (0.05, 1.0, 0.795), (0, 0, 0.2)); box('dark', (0.02, 0.07, 0.06), (0.2, 1.03, 0.8), (0, 0, 0.2))
    box('dark', (0.3, 0.012, 0.008), (0.3, 0.8, 0.754), (0, 0, -0.7)); box('dark', (0.25, 0.012, 0.008), (0.42, 0.62, 0.754), (0, 0, 0.5))
    for x, y, yaw in [(-0.75, 0.9, 0.2), (-0.8, 0.05, -0.35), (-0.55, -0.75, 0.9), (0.6, 1.5, -1.9), (1.35, 0.95, 3.0), (1.3, -0.1, 2.7)]:
        chair_taupe(at(x, y, yaw))

    # ---- back wall, left to right: the printer desk, the wall cabinet and bookshelf, the desk under the posters
    desk(-1.9, -0.55, 3.9, D, legs='metal')
    box('white', (0.42, 0.36, 0.2), (-1.5, 4.2, 0.84)); box('dark', (0.36, 0.02, 0.05), (-1.5, 4.02, 0.88)); box('paper', (0.3, 0.2, 0.004), (-1.5, 4.0, 0.745))
    box('cardboard', (0.75, 0.3, 0.07), (-0.95, 4.2, 0.775), (0, 0, 0.05))
    chair_taupe(at(-1.3, 3.4, 1.4)); chair_taupe(at(-0.7, 3.3, 1.9))
    box('dark', (0.56, 0.36, 0.58), (-0.82, D - 0.18, 1.75))                         # wall cabinet
    bx0, bx1, bd, bh = -0.45, 0.45, 0.32, 1.9                                        # bookshelf, open shelves
    for x in (bx0 + 0.012, bx1 - 0.012): box('dark', (0.024, bd, bh), (x, D - bd / 2, bh / 2))
    box('dark', (bx1 - bx0, 0.02, bh), ((bx0 + bx1) / 2, D - 0.01, bh / 2))
    for z in (0.05, 0.42, 0.79, 1.16, 1.53, bh - 0.012): box('dark', (bx1 - bx0, bd, 0.024), ((bx0 + bx1) / 2, D - bd / 2, z))
    box('red', (0.3, 0.22, 0.12), (0.18, D - 0.16, 0.122)); box('cardboard', (0.22, 0.2, 0.1), (-0.2, D - 0.15, 0.482)); box('paper', (0.2, 0.24, 0.06), (0.1, D - 0.16, 0.832))
    desk(0.7, W, 3.8, D)
    tower(0.9, 4.15, z=0.74, yaw=math.pi / 2)
    for x in (1.3, 1.72, 2.45): monitor(at(x, 4.25, -math.pi / 2, 0.74), w=0.5, h=0.3, zc=0.3, screen='screen_code')
    box('dark', (0.44, 0.14, 0.02), (1.5, 3.97, 0.75)); box('dark', (0.06, 0.1, 0.03), (1.8, 3.97, 0.755))
    box('dark', (0.075, 0.15, 0.01), (1.12, 3.95, 0.745), (0, 0, 0.3))                # his phone, face down
    lap = at(2.02, 4.05, -math.pi / 2 - 0.25, 0.74)                                  # an open laptop
    box('metal', (0.22, 0.32, 0.014), (0, 0, 0.007), M=lap); box('metal', (0.012, 0.32, 0.21), (-0.13, 0, 0.11), (0, -0.25, 0), lap); box('screen_code', (0.004, 0.3, 0.19), (-0.122, 0, 0.11), (0, -0.25, 0), lap)
    box('white', (0.07, 0.07, 0.24), (2.22, 3.98, 0.86))                             # water bottle
    poster(0.5, 1.4, 1.5, 2.45, 'poster_orange', 3); poster(1.6, 2.85, 1.45, 2.55, 'poster_green', 4)
    chair_taupe(at(1.5, 3.3, math.pi / 2))                                           # where the one writing code sits

    # ---- the corner: the filing cabinet, a box and a carton on top
    fx, fy = 2.92, 3.42
    box('cabinet', (0.62, 0.46, 1.32), (fx, fy, 0.66))
    for k in range(4):
        box('cabinet', (0.012, 0.42, 0.29), (fx - 0.316, fy, 0.18 + k * 0.32)); box('metal', (0.02, 0.12, 0.02), (fx - 0.33, fy, 0.27 + k * 0.32))
    box('cardboard', (0.4, 0.42, 0.3), (fx + 0.08, fy, 1.47)); box('white', (0.2, 0.3, 0.05), (fx - 0.18, fy, 1.345))

    # ---- right wall: the whiteboard (the site draws what's written on it, at board_target), then the desk with
    # the two bright screens nearer the door
    by, bz, bw, bh = 1.85, 1.65, 2.0, 1.1
    box('metal', (0.03, bw + 0.06, bh + 0.06), (W - 0.015, by, bz)); box('white', (0.004, bw, bh), (W - 0.032, by, bz))
    box('metal', (0.09, 1.4, 0.015), (W - 0.075, by, bz - bh / 2 - 0.025))            # the tray: two markers and the eraser
    box('dark', (0.022, 0.12, 0.022), (W - 0.085, 2.2, 1.094)); box('red', (0.022, 0.12, 0.022), (W - 0.085, 2.4, 1.094)); box('dark', (0.05, 0.13, 0.035), (W - 0.08, 1.6, 1.1))
    desk(2.55, W, -2.5, 0.0)
    box('backpack', (0.2, 0.32, 0.46), (2.95, -0.25, 0.97), (0, 0.08, 0)); box('backpack', (0.06, 0.24, 0.2), (2.83, -0.25, 0.88))
    monitor(at(3.03, -0.7, math.pi, 0.74), w=0.55, h=0.33, screen='dark')
    box('dark', (0.08, 0.08, 0.17), (2.75, -0.95, 0.825)); box('yellow', (0.28, 0.2, 0.012), (2.72, -1.2, 0.746), (0, 0, 0.2))
    monitor(at(3.03, -1.55, math.pi, 0.74), w=0.68, h=0.39, zc=0.4); monitor(at(3.03, -2.18, math.pi + 0.25, 0.74), w=0.55, h=0.33)
    box('dark', (0.14, 0.44, 0.02), (2.72, -1.6, 0.75)); box('dark', (0.1, 0.06, 0.03), (2.72, -1.96, 0.755))
    chair_mesh(at(2.05, -1.55, 0.0)); tower(2.95, -0.4, yaw=0.0)
    chair_taupe(at(2.0, -2.9, -2.4))


finish('Lab', 'lab', 'lab_', MATS, build,
       {'cam_start': (0, -4.2, 1.6), 'screen_target': (-3.03, 3.0, 1.12), 'board_target': (W - 0.034, 1.85, 1.65)},
       # the preview, from where the photo was taken
       (13, (-2.95, -4.2, 1.75), (1.2, 3.2, 0.7), [(x, y, 2.85) for x in (-1.6, 1.6) for y in (-3, 0, 3)], 220, 0.6))
