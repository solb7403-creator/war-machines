#!/bin/sh
# stamp a new build id into index.html (page + every css/js tag) and version.json; run before every commit that touches the game
cd "$(dirname "$0")/.."
V=$(date -u +%Y%m%d%H%M%S)
sed -i "s/window.BUILD='[^']*'/window.BUILD='$V'/" index.html
sed -i -E "s/\.(css|js)\?v=[0-9]+/.\1?v=$V/g" index.html
printf '{"v":"%s"}\n' "$V" > version.json
echo $V
