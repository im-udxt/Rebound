from lib import Level, emit_ts
L = Level(154)
def mover_h(h, track_a, track_b, start, width=3):
    L.run(h, track_a, track_b, '-')
    for c in range(start, start + width): L.g[h][c] = 'H'
def mover_v(h_start, h_top, col, width=2, h_bottom=None):
    hb = h_start if h_bottom is None else h_bottom
    for h in range(hb, h_top + 1):
        if h != h_start: L.put(h, col, '|')
    for c in range(col, col + width): L.put(h_start, c, 'V')
# A: conveyors over the floor
L.rock(0, 0, 17); L.put(1, 9, 'P'); L.sparks(1, 14)
L.run(3, 2, 7, ')'); L.sparks(4, 3, 5)
L.run(6, 10, 16, '('); L.sparks(7, 11, 13, 15)
L.ledge(9, 1, 6); L.sparks(10, 2, 4)
# B: movers
mover_h(12, 4, 13, 7); L.sparks(13, 6, 10)
L.ledge(15, 14, 17); L.put(16, 16, 'L')
mover_v(16, 22, 10); L.sparks(20, 12); L.sparks(23, 11)
L.ledge(25, 4, 8); L.sparks(26, 5, 7)
# C: goo
L.run(28, 0, 6, 'g'); L.rock(28, 7, 9); L.sparks(29, 2, 8)
L.ledge(31, 11, 15); L.put(32, 13, 'L')
# D: gears
L.put(35, 13, 'G')
L.ledge(34, 5, 9); L.sparks(35, 6, 8)
L.ledge(37, 0, 4); L.sparks(38, 1, 3)
L.put(40, 6, 'G')
L.ledge(40, 9, 13); L.put(41, 11, 'L')
# E: combos
L.rock(41, 0, 7); L.many(42, range(0, 8), '^')
mover_h(43, 1, 12, 6); L.sparks(44, 4, 8)
L.run(46, 13, 17, ')'); L.sparks(47, 14)
L.ledge(49, 8, 12); L.sparks(50, 9, 11)
L.put(52, 14, 'G')
L.run(52, 0, 4, 'g'); L.rock(52, 5, 6); L.put(53, 0, 'M')
L.ledge(55, 9, 13); L.sparks(56, 10)
mover_v(56, 64, 15); L.sparks(60, 13); L.put(59, 11, 'G')
L.ledge(67, 9, 14); L.put(68, 11, 'L'); L.sparks(68, 13)
# F: conveyor gauntlet
L.run(70, 4, 8, '('); L.sparks(71, 6)
L.run(73, 0, 4, ')'); L.sparks(74, 1, 3)
L.ledge(76, 8, 12); L.put(79, 12, 'G'); L.sparks(77, 9)
L.run(79, 13, 17, '('); L.sparks(80, 15)
L.ledge(82, 7, 11); L.put(83, 7, '^'); L.sparks(83, 9)
L.run(85, 1, 5, 'g'); L.rock(85, 6, 7); L.put(86, 1, 'M')
mover_h(88, 8, 16, 10); L.sparks(89, 11)
L.ledge(91, 12, 17); L.sparks(92, 13, 15)
L.ledge(94, 5, 9); L.put(97, 3, 'G'); L.sparks(95, 6)
L.ledge(97, 10, 14); L.put(98, 12, 'L')
# G: elevator past gears
L.ledge(100, 6, 9); L.sparks(101, 7)
mover_v(100, 112, 2); L.put(106, 6, 'G'); L.put(110, 0, 'G')
L.put(104, 9, 'M'); L.put(104, 11, 'G')
L.sparks(105, 3); L.sparks(109, 3)
L.ledge(115, 0, 5); L.sparks(116, 1, 3)
L.run(118, 6, 10, ')'); L.sparks(119, 8)
L.ledge(121, 12, 16); L.sparks(122, 13, 15)
L.run(124, 6, 11, 'g'); L.rock(124, 12, 13); L.sparks(125, 8)
L.ledge(127, 14, 17); L.put(128, 16, 'L')
# H: final machine
mover_h(130, 3, 13, 8); L.sparks(131, 6)
L.ledge(133, 0, 3); L.put(134, 0, 'M'); L.put(137, 2, 'G')
L.run(133, 13, 17, '(')
L.ledge(136, 6, 10); L.sparks(137, 8)
mover_h(139, 9, 17, 12); L.put(141, 17, 'M')
L.ledge(142, 4, 8); L.sparks(143, 5, 7)
L.ledge(145, 10, 14); L.put(147, 7, 'G'); L.sparks(146, 11, 13)
L.ledge(148, 2, 6); L.sparks(149, 3, 5)
L.run(151, 0, 17, 'E')
emit_ts('zone3', 'ZONE3_MACHINE', 'Zone 3 - The Machine (movers, conveyors, goo, gears)', L.rows(), '../../src/levels/zone3.ts')
