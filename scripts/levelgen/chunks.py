# Endless Climb chunks: 15 rows each. Local h0 is a full-width ledge (the chunk base).
# Content must let Pip reach h15 (the next chunk's base): last ledge at h12 or higher.
from lib import Level
chunks = []
def chunk(name, diff):
    def deco(fn):
        L = Level(15)
        L.ledge(0, 0, 17)
        fn(L)
        chunks.append((name, diff, L.rows()))
        return fn
    return deco
def wind(L, h0, h1, a, b, ch):
    for h in range(h0, h1 + 1):
        for c in range(a, b + 1):
            if L.g[h][c] == '.': L.g[h][c] = ch
def mover_h(L, h, a, b, start, width=3):
    L.run(h, a, b, '-')
    for c in range(start, start + width): L.g[h][c] = 'H'
def mover_v(L, h_start, h_top, col, width=2):
    for h in range(h_start + 1, h_top + 1): L.put(h, col, '|')
    for c in range(col, col + width): L.put(h_start, c, 'V')

@chunk('stairs', 1)
def _(L):
    L.put(1, 2, 'L'); L.ledge(3, 2, 7); L.sparks(4, 4); L.ledge(6, 9, 14); L.sparks(7, 11); L.ledge(9, 3, 8); L.ledge(12, 10, 15); L.sparks(13, 12)
@chunk('zigzag', 1)
def _(L):
    L.ledge(3, 12, 17); L.ledge(6, 6, 11); L.sparks(7, 8); L.ledge(9, 0, 5); L.ledge(12, 6, 11); L.sparks(13, 7, 9)
@chunk('twin', 1)
def _(L):
    L.ledge(3, 1, 5); L.ledge(3, 12, 16); L.ledge(6, 6, 11); L.sparks(7, 7, 10); L.ledge(9, 1, 5); L.ledge(9, 12, 16); L.ledge(12, 6, 11)
@chunk('perfect-steps', 2)
def _(L):
    L.ledge(4, 4, 9); L.sparks(5, 6); L.ledge(8, 10, 15); L.sparks(9, 12); L.ledge(12, 4, 9)
@chunk('spike-floor', 2)
def _(L):
    L.rock(5, 6, 11); L.many(4, range(6, 12), 'v'); L.ledge(3, 0, 4); L.ledge(3, 13, 17); L.sparks(6, 7, 10); L.ledge(9, 2, 7); L.ledge(12, 9, 14)
@chunk('tunnel', 2)
def _(L):
    L.sparks(1, 4, 7, 10); L.many(3, range(0, 14), 'v'); L.rock(4, 0, 14); L.ledge(3, 15, 17); L.ledge(6, 10, 14); L.ledge(9, 4, 9); L.ledge(12, 9, 14)
@chunk('crumble-run', 1)
def _(L):
    L.run(3, 3, 7, 'C'); L.run(6, 9, 13, 'C'); L.sparks(7, 11); L.run(9, 3, 7, 'C'); L.ledge(12, 8, 13)
@chunk('crumble-spikes', 3)
def _(L):
    L.put(1, 1, 'L'); L.rock(2, 4, 17); L.many(3, range(4, 18), '^'); L.ledge(4, 0, 3); L.run(6, 6, 8, 'C'); L.run(9, 11, 13, 'C'); L.sparks(10, 12); L.ledge(12, 5, 10)
@chunk('bumper-lift', 1)
def _(L):
    L.put(1, 8, 'B'); L.sparks(4, 8); L.sparks(6, 8); L.ledge(7, 3, 7); L.ledge(7, 10, 14); L.ledge(10, 6, 11); L.ledge(13, 0, 5)
@chunk('bumper-chain', 3)
def _(L):
    L.ledge(3, 2, 6); L.put(4, 4, 'B'); L.ledge(9, 6, 10); L.put(10, 9, 'B'); L.sparks(12, 9); L.many(8, [0, 1], '^'); L.rock(7, 0, 1); L.ledge(13, 3, 8)
@chunk('conveyor', 1)
def _(L):
    L.run(3, 2, 7, ')'); L.run(6, 10, 15, '('); L.sparks(7, 12); L.ledge(9, 3, 8); L.ledge(12, 10, 15)
@chunk('goo-shelf', 2)
def _(L):
    L.run(3, 0, 5, 'g'); L.rock(3, 6, 7); L.ledge(6, 9, 13); L.sparks(7, 11); L.ledge(9, 3, 7); L.ledge(12, 9, 14)
@chunk('mover-h', 2)
def _(L):
    L.ledge(3, 0, 2); mover_h(L, 4, 3, 15, 6); L.sparks(5, 9); L.ledge(7, 15, 17); L.ledge(10, 8, 13); L.ledge(13, 2, 7)
@chunk('elevator', 2)
def _(L):
    L.ledge(3, 0, 4); mover_v(L, 3, 11, 7); L.sparks(7, 9); L.ledge(13, 10, 15)
@chunk('gears', 2)
def _(L):
    L.ledge(3, 5, 9); L.put(5, 12, 'G'); L.ledge(6, 11, 16); L.put(9, 7, 'G'); L.ledge(9, 0, 4); L.ledge(12, 6, 11); L.sparks(13, 8)
@chunk('gear-mover', 3)
def _(L):
    mover_h(L, 3, 0, 17, 7); L.put(6, 5, 'G'); L.put(6, 12, 'G'); L.ledge(6, 8, 9); L.ledge(9, 3, 7); L.ledge(9, 11, 15); L.ledge(12, 7, 11)
@chunk('updraft', 1)
def _(L):
    L.sparks(5, 15); wind(L, 1, 9, 14, 16, '~'); L.ledge(3, 3, 8); L.ledge(6, 0, 4); L.ledge(11, 9, 13); L.ledge(13, 3, 8)
@chunk('crosswind', 2)
def _(L):
    L.ledge(3, 6, 10); L.ledge(6, 1, 4); L.ledge(9, 6, 10); L.ledge(12, 12, 16)
    for h in range(4, 8): L.put(h, 17, '<')
    wind(L, 4, 7, 0, 16, '}')
@chunk('ice', 2)
def _(L):
    L.run(3, 3, 8, 'i'); L.sparks(4, 5); L.ledge(6, 11, 16); L.run(9, 4, 9, 'i'); L.ledge(12, 0, 4)
@chunk('storm-gate', 2)
def _(L):
    L.run(2, 0, 8, 'z'); L.run(2, 9, 17, 'x'); L.ledge(3, 0, 17); L.sparks(4, 4, 13); L.ledge(6, 4, 9); L.ledge(9, 10, 15); L.ledge(12, 4, 9)
@chunk('storm-shaft', 3)
def _(L):
    L.put(5, 14, 'z'); L.put(8, 15, 'x'); wind(L, 1, 10, 14, 16, '~'); L.ledge(3, 4, 9); L.ledge(6, 8, 12); L.ledge(12, 10, 14)
@chunk('wall-spikes', 3)
def _(L):
    for h in range(2, 12): L.put(h, 0, '>'); L.put(h, 17, '<')
    L.ledge(3, 6, 11); L.ledge(6, 2, 6); L.ledge(6, 11, 15); L.ledge(9, 6, 11); L.ledge(12, 3, 8); L.sparks(13, 5)
@chunk('rest', 1)
def _(L):
    L.put(1, 9, 'L'); L.sparks(1, 4, 14); L.ledge(3, 6, 12); L.ledge(6, 1, 6); L.ledge(6, 12, 16); L.ledge(9, 6, 12); L.ledge(12, 2, 7); L.sparks(13, 4)
@chunk('ice-spikes', 3)
def _(L):
    L.run(3, 2, 9, 'i'); L.put(4, 9, '^'); L.ledge(6, 12, 17); L.run(9, 6, 11, 'i'); L.put(10, 6, '^'); L.ledge(12, 1, 5)
@chunk('goo-gears', 3)
def _(L):
    L.run(3, 6, 11, 'g'); L.rock(3, 12, 13); L.put(6, 9, 'G'); L.ledge(6, 14, 17); L.ledge(9, 8, 12); L.ledge(12, 2, 7); L.sparks(13, 4)
@chunk('mixed', 3)
def _(L):
    L.run(3, 11, 14, 'C'); L.put(4, 4, 'B'); L.ledge(3, 2, 6); L.run(6, 14, 17, '('); L.ledge(9, 8, 12); L.put(11, 3, 'G'); L.ledge(12, 13, 17)

with open('../../src/levels/chunks.ts', 'w', encoding='utf8') as f:
    f.write('// Endless Climb chunks. Each is 15 rows; the bottom row is a full ledge (the chunk base).\n')
    f.write('// Laid out with scripts/levelgen/chunks.py. See src/logic/levelParser.ts for the legend.\n\n')
    f.write("export interface Chunk {\n  id: string;\n  /** 1 = gentle, 3 = hard. */\n  difficulty: 1 | 2 | 3;\n  rows: readonly string[];\n}\n\n")
    f.write('export const CHUNKS: readonly Chunk[] = [\n')
    for name, diff, rows in chunks:
        f.write(f"  {{\n    id: '{name}',\n    difficulty: {diff},\n    rows: [\n")
        for r in rows: f.write(f"      '{r}',\n")
        f.write('    ],\n  },\n')
    f.write('];\n')
print(len(chunks), 'chunks')
