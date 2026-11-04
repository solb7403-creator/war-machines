#!/usr/bin/env bash
set -euo pipefail
for test in conquest conquest-travel conquest-view-travel conquest-discovery graphics-motion garage-rules gear-balance gear-combat standard-equipment hf-foundation hf-collection chassis-family defender-isolation defender-visual legendary-visual graphics-release map-layout map-nav combat-balance gem-ui lab-ui velocity; do
  node "dev/tests/$test.mjs"
done
