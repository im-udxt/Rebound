# Helper for authoring REBOUND levels by height (h=0 is the bottom row).
# Emits full 20-column rows (outer walls added), top-to-bottom.
INNER = 18

class Level:
    def __init__(self, height):
        self.height = height
        self.g = [['.'] * INNER for _ in range(height)]

    def put(self, h, c, ch):
        assert 0 <= c < INNER, (h, c)
        assert 0 <= h < self.height, (h, c)
        cur = self.g[h][c]
        if cur != '.' and cur != ch:
            raise ValueError(f'overlap at h{h} c{c}: {cur} vs {ch}')
        self.g[h][c] = ch

    def run(self, h, a, b, ch):
        for c in range(a, b + 1):
            self.put(h, c, ch)

    def ledge(self, h, a, b):
        self.run(h, a, b, '_')

    def rock(self, h, a, b):
        self.run(h, a, b, '#')

    def block(self, h0, h1, a, b, ch='#'):
        for h in range(h0, h1 + 1):
            self.run(h, a, b, ch)

    def many(self, h, cols, ch):
        for c in cols:
            self.put(h, c, ch)

    def sparks(self, h, *cols):
        self.many(h, cols, '*')

    def rows(self):
        return ['#' + ''.join(r) + '#' for r in reversed(self.g)]

def emit_ts(name, export, title, rows, path):
    with open(path, 'w', encoding='utf8') as f:
        f.write(f'// {title}\n// Laid out with scripts/levelgen. Top row = top of the climb.\n')
        f.write('// See src/logic/levelParser.ts for the legend.\n\n')
        f.write(f'export const {export}: readonly string[] = [\n')
        for r in rows:
            f.write(f"  '{r}',\n")
        f.write('];\n')
    print(name, len(rows), 'rows')
