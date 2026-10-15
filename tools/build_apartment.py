# Builds the Apartment scene in assets/rooms.blend, my bedroom in Canyon Creek Heights South, and exports it:
#   blender -b assets/rooms.blend --python tools/build_apartment.py
# Writes public/rooms/apartment.glb, assets/apartment.glb and assets/apartment_preview.png, then saves the .blend.
# Blender axes: x across the room, y towards the window wall, z up. The room is 3.4 x 3.7 x 2.6 m: the door and the
# closet are in the front wall, the bed runs along the left wall, and the desk the tour plays on runs along the
# right wall, across from the bed, with the monitor at its far end and the laptop where I sit.
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roomkit import box, at, star_base, chair_mesh, monitor, finish

W, D, H = 1.7, 1.85, 2.6                      # half width, half depth, height

MATS = {                                       # name: (colour, roughness, emission colour, strength)
    'carpet': ((0.42, 0.39, 0.34), 1.0), 'wall': ((0.86, 0.84, 0.78), 0.9), 'ceiling': ((0.9, 0.9, 0.88), 0.9),
    'trim': ((0.93, 0.93, 0.9), 0.6), 'door': ((0.55, 0.42, 0.3), 0.6), 'closet': ((0.9, 0.89, 0.86), 0.7),
    'metal': ((0.5, 0.51, 0.53), 0.4), 'dark': ((0.03, 0.03, 0.035), 0.5), 'desk': ((0.92, 0.92, 0.9), 0.5),
    'chair_mesh': ((0.045, 0.045, 0.05), 0.8), 'bedframe': ((0.25, 0.17, 0.12), 0.7), 'mattress': ((0.92, 0.92, 0.9), 0.9),
    'blanket': ((0.12, 0.16, 0.3), 1.0), 'pillow': ((0.95, 0.95, 0.93), 0.9), 'bin': ((0.5, 0.5, 0.52), 0.8),
    'night': ((0.02, 0.03, 0.07), 0.3, (0.05, 0.08, 0.18), 0.45), 'blind': ((0.92, 0.92, 0.9), 0.7),
    'light': ((1, 1, 1), 0.5, (1.0, 0.95, 0.85), 0.35), 'lamp': ((1, 0.9, 0.7), 0.5, (1.0, 0.72, 0.4), 1.1),
    'rgb': ((0.2, 0.9, 0.5), 0.3, (0.2, 0.9, 0.5), 3.0), 'glass': ((0.05, 0.06, 0.07), 0.1),
    'screen': ((0.02, 0.05, 0.06), 0.3, (0.15, 0.45, 0.55), 1.2), 'screen_code': ((0.03, 0.04, 0.07), 0.3, (0.07, 0.12, 0.22), 1.0),
    'rug': ((0.08, 0.09, 0.11), 1.0), 'backpack': ((0.27, 0.28, 0.3), 0.9), 'basket': ((0.55, 0.5, 0.45), 0.9),
    'paper': ((0.93, 0.93, 0.9), 0.8), 'mug': ((0.9, 0.9, 0.88), 0.4), 'bottle': ((0.2, 0.3, 0.5), 0.3),
    'plant': ((0.2, 0.45, 0.18), 0.8), 'pot': ((0.6, 0.35, 0.22), 0.8), 'poster': ((0.02, 0.025, 0.04), 0.7),
    'poster_ink': ((0.35, 0.45, 0.55), 0.8), 'red': ((0.6, 0.1, 0.08), 0.7), 'green': ((0.15, 0.4, 0.2), 0.7),
    'yellow': ((0.9, 0.8, 0.3), 0.8), 'blue': ((0.15, 0.25, 0.55), 0.7),
}


def build():
    # ---- shell: carpet, walls, ceiling, the baseboard
    box('carpet', (2 * W, 2 * D, 0.05), (0, 0, -0.025))
    box('ceiling', (2 * W, 2 * D, 0.05), (0, 0, H + 0.025))
    t = 0.12
    box('wall', (t, 2 * D + 2 * t, H), (-W - t / 2, 0, H / 2)); box('wall', (t, 2 * D + 2 * t, H), (W + t / 2, 0, H / 2))
    wx0, wx1, wz0, wz1 = -0.35, 0.95, 0.95, 2.15                     # the window, in the back wall
    box('wall', (wx0 + W, t, H), ((wx0 - W) / 2, D + t / 2, H / 2)); box('wall', (W - wx1, t, H), ((W + wx1) / 2, D + t / 2, H / 2))
    box('wall', (wx1 - wx0, t, wz0), ((wx0 + wx1) / 2, D + t / 2, wz0 / 2)); box('wall', (wx1 - wx0, t, H - wz1), ((wx0 + wx1) / 2, D + t / 2, (H + wz1) / 2))
    d0, d1, dh = -1.5, -0.6, 2.05                                     # the door, in the front wall
    box('wall', (d0 + W, t, H), ((d0 - W) / 2, -D - t / 2, H / 2)); box('wall', (W - d1, t, H), ((W + d1) / 2, -D - t / 2, H / 2))
    box('wall', (d1 - d0, t, H - dh), ((d0 + d1) / 2, -D - t / 2, (H + dh) / 2))
    box('door', (d1 - d0 - 0.02, 0.04, dh - 0.02), ((d0 + d1) / 2, -D + 0.02, dh / 2 - 0.01)); box('metal', (0.04, 0.12, 0.03), (d1 - 0.1, -D + 0.07, 1.0))
    for x, w in ((-W, 0.02), (W, 0.02)): box('trim', (w, 2 * D, 0.1), (x + (0.01 if x < 0 else -0.01), 0, 0.05))
    box('trim', (2 * W, 0.02, 0.1), (0, D - 0.01, 0.05)); box('trim', (d0 + W, 0.02, 0.1), ((d0 - W) / 2, -D + 0.01, 0.05)); box('trim', (W - d1, 0.02, 0.1), ((W + d1) / 2, -D + 0.01, 0.05))
    box('light', (0.34, 0.34, 0.07), (0, 0, H - 0.035))

    # ---- the window: a white frame and sill, night outside, the blinds half drawn
    for z, hh in ((wz0, 0.05), (wz1, 0.05)): box('trim', (wx1 - wx0 + 0.1, 0.06, hh), ((wx0 + wx1) / 2, D - 0.03, z))
    for x in (wx0, wx1): box('trim', (0.05, 0.06, wz1 - wz0), (x, D - 0.03, (wz0 + wz1) / 2))
    box('trim', (wx1 - wx0 + 0.16, 0.14, 0.03), ((wx0 + wx1) / 2, D - 0.07, wz0 - 0.03))
    box('night', (wx1 - wx0, 0.01, wz1 - wz0), ((wx0 + wx1) / 2, D + 0.04, (wz0 + wz1) / 2))
    box('trim', (wx1 - wx0 - 0.02, 0.05, 0.05), ((wx0 + wx1) / 2, D - 0.09, wz1 - 0.03))           # the headrail
    k = 0
    while wz1 - 0.08 - k * 0.05 > wz0 + 0.45:                                                        # slats, down to where they stop
        box('blind', (wx1 - wx0 - 0.04, 0.025, 0.006), ((wx0 + wx1) / 2, D - 0.09, wz1 - 0.08 - k * 0.05), (0.5, 0, 0)); k += 1

    # ---- the front wall: the closet with bifold doors, the laundry basket, shoes by the door
    for x in (0.2 + 0.35, 0.2 + 1.05):
        for s in (-1, 1): box('closet', (0.33, 0.04, dh - 0.04), (x + s * 0.175, -D + 0.04, dh / 2 - 0.02), (0, 0, s * 0.03))
    box('trim', (1.44, 0.08, 0.06), (0.9, -D + 0.04, dh + 0.01))
    box('basket', (0.4, 0.4, 0.55), (-0.3, -D + 0.3, 0.275)); box('blanket', (0.34, 0.34, 0.08), (-0.3, -D + 0.3, 0.58))
    for y in (-1.6, -1.45): box('dark', (0.1, 0.28, 0.08), (-1.25 + (0 if y < -1.5 else 0.14), y, 0.04), (0, 0, 0.2))

    # ---- the left wall: the bed, bins under it, the nightstand under the window
    bx0, bx1, by0, by1 = -W + 0.03, -0.65, -0.21, D                                                # twin XL
    box('bedframe', (bx1 - bx0, by1 - by0, 0.22), ((bx0 + bx1) / 2, (by0 + by1) / 2, 0.24))
    for x in (bx0 + 0.05, bx1 - 0.05):
        for y in (by0 + 0.05, by1 - 0.05): box('bedframe', (0.06, 0.06, 0.14), (x, y, 0.07))
    box('bedframe', (bx1 - bx0, 0.05, 0.95), ((bx0 + bx1) / 2, by1 - 0.03, 0.5))                     # the headboard
    box('mattress', (bx1 - bx0 - 0.06, by1 - by0 - 0.1, 0.2), ((bx0 + bx1) / 2, (by0 + by1) / 2 - 0.02, 0.45))
    box('blanket', (bx1 - bx0 - 0.02, 1.35, 0.06), ((bx0 + bx1) / 2, by0 + 0.72, 0.57), (0.02, 0, 0))
    box('pillow', (0.62, 0.4, 0.12), ((bx0 + bx1) / 2, by1 - 0.32, 0.61), (0, 0, 0.05))
    for y in (0.0, 0.8): box('bin', (0.52, 0.42, 0.16), (-1.1, y, 0.08))
    box('bedframe', (0.44, 0.4, 0.55), (-0.3, D - 0.25, 0.275))
    box('metal', (0.1, 0.1, 0.02), (-0.33, D - 0.28, 0.56)); box('metal', (0.02, 0.02, 0.2), (-0.33, D - 0.28, 0.66))
    box('lamp', (0.2, 0.2, 0.17), (-0.33, D - 0.28, 0.8))
    box('dark', (0.075, 0.15, 0.01), (-0.18, D - 0.18, 0.555), (0, 0, 0.3))                         # my phone, charging
    box('rug', (1.5, 1.8, 0.012), (-0.05, 0.3, 0.006))

    # ---- the right wall: the desk, across from the bed. The monitor at the far end is the screen the tour plays
    # on; I sit at the laptop nearer the door, with the tower under the desk beside me
    dx0, dx1, dy0, dy1 = 1.1, W - 0.02, -0.5, 1.5
    box('desk', (dx1 - dx0, dy1 - dy0, 0.03), ((dx0 + dx1) / 2, (dy0 + dy1) / 2, 0.735))
    for x in (dx0 + 0.04, dx1 - 0.04):
        for y in (dy0 + 0.04, dy1 - 0.04): box('metal', (0.04, 0.04, 0.72), (x, y, 0.36))
    monitor(at(1.48, 1.1, math.pi, 0.74), screen='screen', into='Screen_main')
    box('dark', (0.14, 0.44, 0.02), (1.22, 1.1, 0.75)); box('dark', (0.1, 0.06, 0.03), (1.22, 0.78, 0.755))
    lap = at(1.42, 0.1, math.pi, 0.74)                                                               # the laptop, open
    box('metal', (0.22, 0.32, 0.014), (0, 0, 0.007), M=lap); box('metal', (0.012, 0.32, 0.21), (-0.13, 0, 0.11), (0, -0.25, 0), lap); box('screen_code', (0.004, 0.3, 0.19), (-0.122, 0, 0.11), (0, -0.25, 0), lap)
    box('dark', (0.12, 0.12, 0.02), (1.58, 1.52, 0.76)); box('metal', (0.02, 0.02, 0.4), (1.58, 1.52, 0.96)); box('lamp', (0.16, 0.08, 0.05), (1.5, 1.46, 1.17), (0, 0.3, 0))
    box('mug', (0.08, 0.08, 0.1), (1.56, 0.55, 0.8)); box('bottle', (0.07, 0.07, 0.24), (1.58, 0.9, 0.87))
    box('paper', (0.21, 0.28, 0.01), (1.3, 0.45, 0.755), (0, 0, 0.2)); box('dark', (0.01, 0.14, 0.01), (1.36, 0.42, 0.765), (0, 0, 0.6))
    tx, ty = 1.46, -0.28                                                                             # the tower: glass side to the room, the card lit inside
    box('dark', (0.21, 0.45, 0.46), (tx, ty, 0.23)); box('glass', (0.004, 0.41, 0.4), (tx - 0.107, ty, 0.24))
    box('rgb', (0.012, 0.28, 0.03), (tx - 0.09, ty, 0.3)); box('rgb', (0.012, 0.03, 0.03), (tx - 0.09, ty + 0.17, 0.4))
    box('metal', (0.02, 0.06, 0.06), (tx - 0.105, ty - 0.19, 0.42))
    box('backpack', (0.2, 0.32, 0.46), (0.6, -0.75, 0.23), (0, 0.12, 0.4))
    chair_mesh(at(0.95, 0.1, 0.0))
    # the shelf over the desk: books, a plant; the print above the monitor
    box('desk', (0.22, 1.2, 0.03), (W - 0.11, 0.6, 1.75))
    for y in (0.15, 1.05): box('metal', (0.18, 0.03, 0.03), (W - 0.09, y, 1.72))
    for i, m in enumerate(('red', 'blue', 'green', 'yellow', 'dark', 'blue')):
        box(m, (0.17, 0.035 + 0.01 * (i % 2), 0.22 + 0.03 * (i % 3)), (W - 0.1, 0.12 + i * 0.05, 1.765 + (0.22 + 0.03 * (i % 3)) / 2), (0, 0, 0.04 * (i == 5)))
    box('pot', (0.11, 0.11, 0.11), (W - 0.11, 1.05, 1.82))
    for dx, dy, dz, s in ((0, 0, 0.14, 0.14), (0.04, 0.05, 0.1, 0.1), (-0.04, -0.04, 0.11, 0.09)): box('plant', (s, s, 0.05), (W - 0.11 + dx, 1.05 + dy, 1.875 + dz), (0.3, 0.2, 0))
    box('poster', (0.01, 0.52, 0.38), (W - 0.006, 1.1, 2.15))
    for i in range(4):
        for j in range(3):
            box('poster_ink', (0.004, 0.1, 0.09), (W - 0.012, 1.1 - 0.195 + i * 0.13, 2.15 + 0.12 - j * 0.12))


finish('Apartment', 'apartment', 'apt_', MATS, build,
       {'cam_start': (-0.95, -1.7, 1.55), 'screen_target': (1.48, 1.1, 1.12)},
       # the preview, from the door
       (14, (-1.1, -1.7, 1.6), (0.9, 0.8, 0.95), [(-0.6, -0.8, 2.45), (0.6, 0.9, 2.45), (0.0, 0.0, 2.45)], 90, 0.5))
