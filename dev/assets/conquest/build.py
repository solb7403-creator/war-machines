"""Original LUNAR command bastion and Parasite plasma battery.
Cloud build: blender --background --python dev/assets/conquest/build.py
No downloaded meshes/textures. Blender 4.3+, static glTF 2.0, +Y runtime up.
Art only: collision remains canonical shared simulation and is never exported.
"""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..'))
OUT=os.path.join(ROOT,'js/assets/conquest-v1')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=.55,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.38
 p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
allmats={}
allmats['command']=[material('Bastion graphite',(.055,.085,.12)),material('Bastion titanium',(.36,.49,.57)),material('Bastion ion channels',(.16,.85,.88),.3,.5)]
allmats['raid']=[material('Parasite obsidian',(.095,.035,.065)),material('Parasite armored carapace',(.32,.10,.14)),material('Parasite plasma ceramic',(.98,.24,.075),.3,.5)]
variants=[]
def cube(name,loc,scale,mat,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Authored armor edge','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.data.materials.append(mat);return o
def cyl(name,loc,radius,depth,mat,vertices=8,rotation=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name
 if rotation:o.rotation_euler=rotation
 o.data.materials.append(mat);return o
def build(name,quality):
 low=quality=='low';m=allmats[name];parts=[]
 def box(label,pos,size,slot=0,bevel=.1):
  o=cube(label,pos,size,m[slot],0 if low else bevel);parts.append(o);return o
 def tube(label,pos,r,d,slot=1,rotation=None):
  o=cyl(label,pos,r,d,m[slot],6 if low else 10,rotation);parts.append(o);return o
 if name=='command':
  box('Armored foundation',(0,0,.45),(16,14,.9),0,.25)
  box('Main faceted citadel',(0,1,3),(10,8,5),1,.65)
  box('Hangar aperture',(0,-3.15,2.2),(7,.3,3.4),0)
  box('Hangar ion lintel',(0,-3.4,4.1),(8,.3,.25),2)
  for x in [-1,1]:
   box('Split forward bastion',(x*6,-2,2),(2.5,8,3.3),1,.35)
   box('Bastion luminous seam',(x*6,-4,3.75),(2.2,.22,.15),2)
   box('Upper fin tower',(x*4.5,3,6),(1.4,3,8),0,.18)
   box('Tower crown',(x*4.5,3,10),(2.1,3.3,.6),1,.2)
   box('Tower command strip',(x*4.5,1.4,7),(.3,.2,5),2)
  tube('Command core',(0,2,6),2,5,0)
  tube('Command lantern',(0,2,9.2),2.4,1.2,2)
  tube('Antenna',(0,2,12),.2,4,1)
  for y in [-1,1]:
   box('Apron guide',(y*3,-5,.95),(.15,3,.12),2)
  if not low:
   for x in [-1,1]:
    for y in [-2,0,2]:box('Layered armor vent',(x*5.1,y,4.05),(.7,1.15,.14),0,.02)
    for y in [-5,5]:tube('Foundation anchor',(x*6,y,1.2),.55,1.5,0)
   for x in [-2,-1,0,1,2]:box('Roof heat exchanger',(x*1.4,2,5.7),(.8,3,.2),0,.03)
 else:
  box('Battery foundation',(0,0,.45),(15,13,.9),0,.25)
  tube('Armored battery pedestal',(0,1,2),5,3,1)
  tube('Plasma reactor drum',(0,1,4.2),3.8,1.6,0)
  tube('Reactor exposed tell',(0,1,5.2),3.3,.5,2)
  for x in [-1,1]:
   box('Recoil cradle',(x*3,-.8,5.7),(1.5,6,3),1,.3)
   barrel=box('Twin plasma lance',(x*2,-4,7),(1.2,10,1.4),0,.2);barrel.rotation_euler.x=-.23
   box('Readable glowing muzzle',(x*2,-9,8.1),(1.1,.25,1.2),2)
   fin=box('Carapace wing',(x*5,2,4),(2,6,2.7),1,.35);fin.rotation_euler.y=x*.32
   box('Weapon heat channel',(x*2,-3,7.8),(.25,6,.2),2)
  tube('Targeting mast',(5,4,6),.25,11,1)
  box('Targeting eye',(5,3.7,10),(2,.5,1),2)
  if not low:
   for x in [-1,1]:
    for y in [-3,0,3]:box('Armor rib',(x*5,y,4.5),(1.6,.4,.35),0,.05)
    tube('Recoil piston',(x*3,-2,6),.3,4,1,(math.pi/2,0,0))
   for y in [-1,1]:tube('Cooling port',(0,y*3,4),.6,2,0,(math.pi/2,0,0))
 # Join by material: three bounded draw calls regardless of authored detail.
 joined=[]
 batches=[(mat,[o for o in parts if o.data.materials[0]==mat]) for mat in m]
 for mat,selected in batches:
  bpy.ops.object.select_all(action='DESELECT')
  for o in selected:o.select_set(True)
  bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();o=bpy.context.object
  o.name=name+'-'+quality+'-'+mat.name
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  joined.append(o)
 bpy.ops.object.select_all(action='DESELECT')
 for o in joined:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'-'+quality+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True)
 # Keep source variants visible in source scene at intentional gallery offsets.
 for o in joined:o.location.x += len(variants)*24
 variants.append(name+'-'+quality)
for name in ['command','raid']:
 for quality in ['high','low']:build(name,quality)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(__file__),'lunar-command-and-battery.blend'))
print('LUNAR_CONQUEST_ASSETS_OK',variants)
