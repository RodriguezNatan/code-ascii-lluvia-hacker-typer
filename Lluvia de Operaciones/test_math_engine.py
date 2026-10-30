import random
import re
import unittest
from fractions import Fraction

from math_engine import (
    DIFFICULTIES, OPERATIONS, Engine, generate_question, parse_number,
    fmt_number, polynomial_text, derivative, integral, speed, spawn_interval,
    RULES, LEVEL_GOAL, LIVES, SYMBOLIC,
)
from mobile_layout import safe_insets, control_dimensions


class TestQuestionGenerator(unittest.TestCase):
    def test_72_modes_generation(self):
        for op in OPERATIONS:
            for level in (1, 10, 11):
                for d in DIFFICULTIES:
                    if level == 11 and d != 'Imposible':
                        continue
                    for frac_mode in (False, True):
                        for seed in range(70):
                            with self.subTest(op=op, difficulty=d, frac=frac_mode,
                                              level=level, seed=seed):
                                q = generate_question(op, d, frac_mode,
                                                      rng=random.Random(seed), level=level)
                                self.assertTrue(q.text)
                                if op in SYMBOLIC:
                                    self.assertEqual(len(q.choices), 4)
                                    self.assertEqual(len(set(q.choices)), 4)
                                    self.assertIn(q.correct_choice, q.choices)
                                else:
                                    self.assertIsInstance(q.answer, Fraction)
                                    self.assertEqual(parse_number(fmt_number(q.answer)), q.answer)

    def test_multiplication_ranges(self):
        for d, lo, hi in [('Easy',1,9),('Medium',10,99),('Hard',100,999),
                           ('Imposible',100,999)]:
            for seed in range(50):
                q = generate_question('multiplicacion', d,
                                      rng=random.Random(seed))
                a,b = q.text.split(' × ')
                self.assertTrue(lo <= int(a) <= hi)
                self.assertTrue(lo <= int(b) <= hi)
                self.assertEqual(q.answer, Fraction(int(a)*int(b)))

    def test_exact_roots(self):
        for d in DIFFICULTIES:
            for frac in (False,True):
                for seed in range(70):
                    q = generate_question('raices', d, frac, random.Random(seed))
                    radicand = q.text.removeprefix('√(').removesuffix(')')
                    self.assertEqual(q.answer*q.answer, parse_number(radicand))
                    self.assertGreaterEqual(q.answer, 0)

    def test_all_symbolic_actions_are_valid(self):
        for d in DIFFICULTIES:
            for frac in (False,True):
                for op in SYMBOLIC:
                    for seed in range(40):
                        e=Engine(op,d,frac,seed=seed)
                        q=e.falling[0].question
                        self.assertEqual(e.submit(q.correct_choice),'correct')
                        self.assertEqual(e.lives,LIVES)

    def test_polynomials(self):
        co=[Fraction(2),Fraction(-3),Fraction(4)]
        self.assertEqual(derivative(co), [Fraction(-3),Fraction(8)])
        self.assertEqual(derivative(integral(co)), co)
        self.assertEqual(polynomial_text(co),'4x² - 3x + 2')

    def test_parser(self):
        self.assertEqual(parse_number('-2/4'),Fraction(-1,2))
        self.assertEqual(parse_number('3'),Fraction(3))
        self.assertIsNone(parse_number('1/0'))
        self.assertIsNone(parse_number('1.5'))
        self.assertIsNone(parse_number('x'))

    def test_level_progression(self):
        e=Engine('multiplicacion','Easy',seed=7)
        for i in range(LEVEL_GOAL):
            q=e.falling[0].question
            answer=fmt_number(q.answer)
            result=e.submit(answer)
        self.assertEqual(result,'level_up')
        self.assertEqual(e.level,2)
        self.assertEqual(e.correct_in_level,0)
        self.assertEqual(e.total_correct,LEVEL_GOAL)
        self.assertGreater(e.score,0)

    def test_lives_and_game_over(self):
        e=Engine('multiplicacion','Easy',seed=9)
        for i in range(LIVES):
            self.assertIn(e.submit('999999999999999999'),('incorrect',))
        self.assertEqual(e.lives,0)
        self.assertEqual(e.state,'lost')
        self.assertEqual(e.submit('3'),'inactive')

    def test_campaign_completion(self):
        e=Engine('suma','Easy',seed=3)
        for _ in range(RULES['Easy'].levels*LEVEL_GOAL):
            q=e.falling[0].question
            result=e.submit(fmt_number(q.answer))
        self.assertEqual(result,'won')
        self.assertEqual(e.state,'won')
        self.assertEqual(e.level,10)

    def test_impossible_rules(self):
        with self.assertRaises(ValueError):
            Engine('suma','Imposible',infinite=True)
        for seed in range(50):
            hard=generate_question('multiplicacion','Hard',rng=random.Random(seed),level=10)
            impossible=generate_question('multiplicacion','Imposible',rng=random.Random(seed),level=10)
            self.assertEqual(hard,impossible)
        for level in range(1,11):
            self.assertEqual(speed('Hard',level),speed('Imposible',level))
            self.assertEqual(spawn_interval('Hard',level),spawn_interval('Imposible',level))
        self.assertGreater(speed('Imposible',20),speed('Hard',10))

    def test_infinite_mode(self):
        for d in DIFFICULTIES[:3]:
            e=Engine('suma',d,infinite=True)
            e.level=RULES[d].levels
            e.correct_in_level=LEVEL_GOAL-1
            out=e.submit(fmt_number(e.falling[0].question.answer))
            self.assertEqual(out,'level_up')
            self.assertEqual(e.level,RULES[d].levels+1)

    def test_pause(self):
        e=Engine('suma','Easy',seed=1)
        e.toggle_pause()
        e.advance(1,200)
        self.assertEqual(e.falling[0].distance,0)
        e.toggle_pause()
        e.advance(.1,200)
        self.assertGreater(e.falling[0].distance,0)

    def test_mobile_dimensions(self):
        self.assertEqual(safe_insets('win',700)['top'],0)
        self.assertGreater(safe_insets('ios',700)['top'],0)
        self.assertGreater(control_dimensions(700,True)['option_height'],0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
