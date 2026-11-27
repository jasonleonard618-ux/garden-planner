#!/bin/sh
# Regenerates the Build step drawings into public/drawings.
cd "$(dirname "$0")"
for p in beds fences details; do python3 $p.py ../../public/drawings; done
python3 thumbs.py ../../public/drawings
python3 tank.py ../../public/drawings
