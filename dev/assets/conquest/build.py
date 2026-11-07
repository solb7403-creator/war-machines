"""Original LUNAR Conquest architecture in the "Neon Frontline" art direction (Phase 2 graphics overhaul).
Cloud build: blender --background --python dev/assets/conquest/build.py   (verified with Blender 4.0.2)
No downloaded meshes/textures. Static glTF 2.0 (+Y up at runtime) for js/conquest/assets.js, the constrained parser:
<=3 meshes/materials/draws, <=3000 triangles HIGH, <=1000 LOW, POSITION/NORMAL only, no textures or extensions.
In game, js/conquest/style.js adopts each mesh into the style's single solid shader: base colour -> vertex colour,
emission -> glow. Art only: collision stays the canonical shared simulation and is never exported.

command  Command citadel for Command Base tier III+ (sits on the r7.6 reactor plinth, sim footprint r8 at (-7, 8)).
raid     Parasite plasma spire placed beside the active raid (decor; kept slim, r<=2.6 m root).
"""
import bpy, math, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
OUT = os.path.join(ROOT, 'js/assets/conquest-v1')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name, color, metal=.5, rough=.45, emission=0.0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    # Strength <= 1 keeps the export free of KHR_materials_emissive_strength (the game's parser accepts no extensions).
    p.inputs['Emission Color'].default_value = (*color, 1); p.inputs['Emission Strength'].default_value = emission
    return m

MATS = {
    'command': [material('Citadel graphite armour', (.11, .14, .18), .55, .5), material('Citadel titanium panels', (.56, .63, .7), .6, .38),
                material('Citadel ion channels', (.13, .9, 1.0), .2, .3, 1.0)],
    'raid': [material('Parasite chitin', (.07, .035, .09), .2, .55), material('Parasite carapace', (.19, .08, .22), .3, .45),
             material('Parasite plasma', (1.0, .17, .84), .1, .3, 1.0)],
}

def build(name, quality):
    low = quality == 'low'; m = MATS[name]; parts = []
    def keep(o, slot, smooth=False):
        o.data.materials.append(m[slot]); parts.append(o)
        if not smooth:
            for poly in o.data.polygons: poly.use_smooth = False
        return o
    def prism(label, loc, r1, r2, depth, slot, sides, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
        o = bpy.context.object; o.name = label; return keep(o, slot)
    def box(label, loc, size, slot, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.object; o.name = label
        o.scale = size; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); return keep(o, slot)
    def orb(label, loc, r, slot, sub=1, scale=(1, 1, 1)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc); o = bpy.context.object; o.name = label
        o.scale = scale; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); return keep(o, slot)
    if name == 'command':
        prism('Armoured drum', (0, 0, 1.1), 6.6, 6.2, 2.2, 0, 8)
        prism('Drum ion band', (0, 0, 2.38), 6.75, 6.75, .32, 2, 8)
        prism('Core tower', (0, 0, 6.8), 4.3, 3.9, 8.8, 1, 6)
        prism('Mid collar', (0, 0, 7.2), 4.75, 4.75, .8, 0, 6)
        prism('Command deck', (0, 0, 11.7), 5.6, 5.2, 1.4, 1, 8)
        prism('Deck window band', (0, 0, 11.75), 5.68, 5.4, .36, 2, 8)
        prism('Crown', (0, 0, 13.9), 3.2, 1.3, 3.0, 0, 6)
        prism('Mast', (0, 0, 18.9), .26, .16, 7.0, 1, 6)
        orb('Mast beacon', (0, 0, 22.6), .62, 2, 1)
        for k in range(6):
            a = math.pi / 6 + k * math.pi / 3
            box('Corner ion strip', (math.cos(a) * 4.08, math.sin(a) * 4.08, 6.8), (.18, .18, 8.2), 2, (0, 0, a))
        if not low:
            for k in range(4):
                a = k * math.pi / 2 + math.pi / 4
                box('Buttress', (math.cos(a) * 5.1, math.sin(a) * 5.1, 3.6), (1.4, 2.2, 4.6), 0, (0, -.32, a))
            for k in range(8):
                a = k * math.pi / 4
                box('Deck radiator', (math.cos(a) * 4.6, math.sin(a) * 4.6, 12.75), (.12, 1.5, .7), 1, (0, 0, a))
            for z in (4.4, 9.2):
                prism('Tower ion ring', (0, 0, z), 4.45, 4.45, .22, 2, 6)
    else:
        orb('Chitin root', (0, 0, .2), 1, 0, 1 if low else 2, (2.6, 2.3, 1.4))
        prism('Main spire', (0, 0, 4.9), 1.15, .05, 9.2, 1, 5, (0.05, -0.04, 0))
        for k, (a, h, r, lean) in enumerate([(0.3, 5.6, .7, .32), (1.6, 4.4, .6, .4), (2.8, 6.0, .72, .28), (4.1, 3.6, .5, .45), (5.2, 4.9, .62, .36)][:3 if low else 5]):
            x, y = math.cos(a) * 1.25, math.sin(a) * 1.15
            prism('Shard', (x + math.cos(a) * h * .18, y + math.sin(a) * h * .18, h / 2 - .2), r, .04, h, 1, 5, (math.sin(a) * lean, -math.cos(a) * lean, 0))
        orb('Plasma core', (0, 0, 3.9), .55, 2, 1)
        for k in range(3 if low else 5):
            a = k * 2 * math.pi / (3 if low else 5) + .4
            box('Vein', (math.cos(a) * .72, math.sin(a) * .72, 4.6), (.12, .12, 6.4), 2, (math.sin(a) * .1, -math.cos(a) * .1, a))
        orb('Spire tip', (0, 0, 9.55), .24, 2, 1)
    # Join by material: at most three bounded draw calls regardless of authored detail.
    joined = []
    batches = [(mat, [o for o in parts if o.data.materials[0] == mat]) for mat in m]  # before any join removes objects
    for mat, sel in batches:
        if not sel: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in sel: o.select_set(True)
        bpy.context.view_layer.objects.active = sel[0]; bpy.ops.object.join(); o = bpy.context.object
        o.name = name + '-' + quality + '-' + mat.name; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); joined.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '-' + quality + '.glb'), export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_texcoords=False, export_normals=True, export_extras=False)
    for o in joined: o.location.x += len(VARIANTS) * 30   # gallery offsets in the saved .blend
    VARIANTS.append(name + '-' + quality)

VARIANTS = []
for name in ['command', 'raid']:
    for quality in ['high', 'low']: build(name, quality)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(__file__), 'lunar-command-and-battery.blend'))
print('LUNAR_CONQUEST_ASSETS_OK', VARIANTS)
