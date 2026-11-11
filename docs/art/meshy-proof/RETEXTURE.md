# The four models that gain the most from a Meshy retexture (Session 5E-1)

How to use one: in Meshy open the model, **Retexture**, paste the prompt, download the GLB, put it next to the other originals,
then in `dev/assets/meshy/config.json` set that item's `"src"` to the new file name and add `"textured": true`, and rerun
`python dev/assets/meshy/build.py --only <id>`. Nothing else changes: cuts, motion and glow stay as configured.

Chassis are not on this list on purpose: their armour has to stay paint-tintable (stock, Gold Plate, Nebula, Void, Lunar
Skin...), which a baked Meshy texture would fight. Weapons and town items are never repainted, so a texture is pure gain.

1. **Command Center** (`town-cc`) — the biggest thing in every town and on every town card. Its walls are large flat faces, so
   the code-made colour can only light the windows on four sides. A texture adds panel work, signage and window rows.
   Prompt: `lunar military command fortress, weathered grey-white armored concrete and gunmetal steel panels, rows of small
   glowing cyan windows on every tier, gold trim on the top parapet, hazard-striped blast gates, panel lines, rivets, dust in
   the creases, realistic PBR, no text, no logos`
2. **Titanfall** (`weapon-siege-2`) — the top Epic siege gun, seen close in the Garage. The amber energy seams and layered
   plate edges of the design are not in the mesh, so today it reads as dark metal with gold bands only.
   Prompt: `massive artillery tank turret, dark gunmetal layered armor plates, polished gold trim on plate edges, gold barrel
   bands and an enormous gold muzzle, thin glowing amber energy seams between the plates, worn edges, realistic PBR metal,
   no text, no markings`
3. **Nova Pulse** (`weapon-pulse-2`) — its star-core reactor is a 3 mm relief, so it shows as a plain amber disc.
   Prompt: `faceted energy cannon tank turret, dark metal armor with gold accents, a glowing amber star-shaped reactor core set
   in a gold ring on each side, thick barrel with gold sleeve bands and a large gold muzzle bell, glowing amber seams along
   the body, realistic PBR metal, no text, no markings`
4. **Storage Depot** (`town-storage`) — a box of very large faces: only the doors, ribs and one light strip can be coloured
   in code.
   Prompt: `armored lunar warehouse, weathered grey-white wall panels with panel lines and rivets, dark roller doors with
   yellow and black hazard edges, a glowing cyan light strip along the long walls, stencilled bay marks without readable
   text, dust and scuffs, realistic PBR, no logos`
