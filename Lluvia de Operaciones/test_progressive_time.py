import unittest
from math_engine import Engine, OPERATIONS, RULES

class ProgressiveTimeTests(unittest.TestCase):
    def test_time_decreases_and_motion_matches_in_every_mode(self):
        for difficulty, rule in RULES.items():
            for operation in OPERATIONS:
                for fractions in (False, True):
                    e = Engine(operation, difficulty, fractions, fall_seconds=60)
                    previous = 61
                    for level in range(1, rule.levels + 1):
                        e.level = level
                        seconds = e.current_fall_seconds
                        self.assertLess(seconds, previous)
                        previous = seconds
                        card = e.falling[0]
                        before = card.distance
                        e.advance(.1, 400)
                        self.assertAlmostEqual(card.distance-before, 400/seconds*.1)
                    e.level = 1
                    self.assertAlmostEqual(e.current_fall_seconds, 60)

    def test_extended_range_and_automatic(self):
        self.assertEqual(Engine('suma','Easy',fall_seconds=120).current_fall_seconds,120)
        self.assertIsNone(Engine('suma','Easy').current_fall_seconds)
        for value in (0,121,float('nan')):
            with self.assertRaises(ValueError): Engine('suma','Easy',fall_seconds=value)

