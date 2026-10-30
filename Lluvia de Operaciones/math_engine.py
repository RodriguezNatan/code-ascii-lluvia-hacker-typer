"""Motor matemático autónomo para Lluvia Matemática (sin red ni dependencias externas).

La representación exacta usa fractions.Fraction. Los problemas simbólicos se
contestan seleccionando una de cuatro opciones para evitar ambigüedades de texto.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
import random
import re
from typing import Optional

OPERATIONS = {
    "suma": "Sumas",
    "resta": "Restas",
    "multiplicacion": "Multiplicaciones",
    "division": "Divisiones",
    "raices": "Raíces",
    "potencias": "Potencias",
    "factorizacion": "Factorización",
    "derivadas": "Derivadas",
    "integrales": "Integrales",
}
DIFFICULTIES = ("Easy", "Medium", "Hard", "Imposible")
SYMBOLIC = {"factorizacion", "derivadas", "integrales"}
LEVEL_GOAL = 10
LIVES = 3
LANES = 2


@dataclass(frozen=True)
class Difficulty:
    minimum: int
    maximum: int
    levels: int
    initial_speed: float
    speed_step: float
    spawn_initial: float
    spawn_step: float
    min_spawn: float
    score_weight: int


RULES = {
    "Easy": Difficulty(1, 9, 10, 55.0, 10.0, 4.0, 0.24, 1.15, 1),
    "Medium": Difficulty(10, 99, 10, 35.0, 6.5, 6.8, 0.30, 2.0, 2),
    "Hard": Difficulty(100, 999, 10, 21.0, 3.5, 11.0, 0.45, 2.6, 3),
    "Imposible": Difficulty(100, 999, 20, 21.0, 3.5, 11.0, 0.45, 2.6, 4),
}


def speed(difficulty: str, level: int, operation: str = "multiplicacion", fractions_mode: bool = False) -> float:
    if difficulty not in RULES or operation not in OPERATIONS or level < 1:
        raise ValueError("Dificultad, nivel u operación inválidos")
    if difficulty == "Imposible" and level > 10:
        v = speed("Hard", 10) * (1 + 0.18 * (level - 10))
    else:
        rule = RULES["Hard"] if difficulty == "Imposible" else RULES[difficulty]
        v = rule.initial_speed + rule.speed_step * (level - 1)
    # Fracciones y álgebra requieren lectura adicional. Imposible-Hard mantiene equivalencia.
    factor = 0.57 if operation in SYMBOLIC else (0.76 if fractions_mode else 1.0)
    return v * factor


def spawn_interval(difficulty: str, level: int) -> float:
    if difficulty not in RULES or level < 1:
        raise ValueError("Dificultad o nivel inválidos")
    if difficulty == "Imposible" and level > 10:
        return spawn_interval("Hard", 10) / (1 + 0.13 * (level - 10))
    rule = RULES["Hard"] if difficulty == "Imposible" else RULES[difficulty]
    return max(rule.min_spawn, rule.spawn_initial - rule.spawn_step * (level - 1))


def fmt_number(num: Fraction | int) -> str:
    n = Fraction(num)
    return str(n.numerator) if n.denominator == 1 else f"{n.numerator}/{n.denominator}"


def parse_number(raw: str) -> Optional[Fraction]:
    raw = raw.strip().replace(" ", "")
    if not re.fullmatch(r"[+-]?\d+(?:/[1-9]\d*)?", raw):
        return None
    try:
        if "/" in raw:
            p, q = raw.split("/")
            return Fraction(int(p), int(q))
        return Fraction(int(raw))
    except (ValueError, ZeroDivisionError):
        return None


SUPERSCRIPTS = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def polynomial_text(coeffs: list[Fraction]) -> str:
    terms: list[tuple[str, str]] = []
    for degree in range(len(coeffs) - 1, -1, -1):
        coefficient = Fraction(coeffs[degree])
        if coefficient == 0:
            continue
        magnitude = abs(coefficient)
        coefficient_text = "" if degree > 0 and magnitude == 1 else fmt_number(magnitude)
        variable = "" if degree == 0 else "x" if degree == 1 else "x" + str(degree).translate(SUPERSCRIPTS)
        terms.append(("-" if coefficient < 0 else "+", coefficient_text + variable))
    if not terms:
        return "0"
    head = ("-" if terms[0][0] == "-" else "") + terms[0][1]
    return head + "".join(f" {sign} {term}" for sign, term in terms[1:])


def derivative(coeffs: list[Fraction]) -> list[Fraction]:
    return [coeffs[i] * i for i in range(1, len(coeffs))] or [Fraction(0)]


def integral(coeffs: list[Fraction]) -> list[Fraction]:
    return [Fraction(0)] + [coeffs[i] / (i + 1) for i in range(len(coeffs))]


def two_factors(root1: Fraction, root2: Fraction) -> str:
    def factor(root: Fraction) -> str:
        if root == 0:
            return "(x)"
        return f"(x {'-' if root > 0 else '+'} {fmt_number(abs(root))})"
    return factor(root1) + factor(root2)


@dataclass(frozen=True)
class Question:
    text: str
    answer: Optional[Fraction] = None
    choices: tuple[str, ...] = ()
    correct_choice: str = ""

    @property
    def symbolic(self) -> bool:
        return bool(self.choices)


def _factors(difficulty: str, rng: random.Random) -> tuple[int, int]:
    rule = RULES[difficulty]
    return rng.randint(rule.minimum, rule.maximum), rng.randint(rule.minimum, rule.maximum)


def _rational(difficulty: str, rng: random.Random) -> Fraction:
    den_max = {"Easy": 9, "Medium": 16, "Hard": 28, "Imposible": 36}[difficulty]
    den = rng.randint(2, den_max)
    numerator = rng.randint(1, den * (1 if difficulty == "Easy" else 3))
    if rng.random() < 0.23:
        numerator *= -1
    return Fraction(numerator, den)


def _shuffle_options(correct: str, wrong: list[str], rng: random.Random) -> tuple[str, ...]:
    unique = [correct]
    for item in wrong:
        if item not in unique:
            unique.append(item)
        if len(unique) == 4:
            break
    if len(unique) != 4:
        raise RuntimeError("No se pudieron formar cuatro opciones únicas")
    rng.shuffle(unique)
    return tuple(unique)


def _poly_coeffs(difficulty: str, fraction_mode: bool, rng: random.Random, integral_mode: bool) -> list[Fraction]:
    degree = {"Easy": 2, "Medium": 3, "Hard": 4, "Imposible": 5}[difficulty]
    if integral_mode:
        degree -= 1
    if fraction_mode:
        coeffs = [Fraction(rng.randint(-5, 5), rng.randint(2, 6)) for _ in range(degree + 1)]
    else:
        bound = 4 if difficulty == "Easy" else 7
        coeffs = [Fraction(rng.randint(-bound, bound)) for _ in range(degree + 1)]
    if not coeffs[-1]:
        coeffs[-1] = Fraction(1, 2) if fraction_mode else Fraction(2)
    return coeffs


def _symbolic_question(operation: str, difficulty: str, fraction_mode: bool, rng: random.Random) -> Question:
    if operation == "factorizacion":
        if fraction_mode:
            r1, r2 = _rational(difficulty, rng), _rational(difficulty, rng)
        else:
            bound = {"Easy": 5, "Medium": 10, "Hard": 16, "Imposible": 20}[difficulty]
            r1, r2 = Fraction(rng.randint(-bound, bound)), Fraction(rng.randint(-bound, bound))
        poly = [r1 * r2, -(r1 + r2), Fraction(1)]
        correct = two_factors(r1, r2)
        delta = Fraction(1, 2) if fraction_mode else Fraction(1)
        # Evita opciones algebraicamente equivalentes por permutación de factores.
        keyed: set[tuple[Fraction, Fraction]] = {(r1 + r2, r1 * r2)}
        unique: list[str] = []
        root_pairs = [
            (r1 + delta, r2), (r1, r2 - delta), (-r1, r2),
            (r1 - delta, r2 + delta), (r1 + 2 * delta, r2 + delta),
            (r1 + 3 * delta, r2 - 2 * delta),
        ]
        for a, b in root_pairs:
            key = (a + b, a * b)
            if key not in keyed:
                keyed.add(key)
                unique.append(two_factors(a, b))
        return Question("Factoriza: " + polynomial_text(poly), choices=_shuffle_options(correct, unique, rng), correct_choice=correct)

    coeffs = _poly_coeffs(difficulty, fraction_mode, rng, operation == "integrales")
    if operation == "derivadas":
        answer_coeffs = derivative(coeffs)
        correct = polynomial_text(answer_coeffs)
        prompt = "d/dx [" + polynomial_text(coeffs) + "]"
    else:
        answer_coeffs = integral(coeffs)
        correct = polynomial_text(answer_coeffs) + " + C"
        prompt = "∫ (" + polynomial_text(coeffs) + ") dx"

    wrong: list[str] = []
    # Distractores creados modificando la forma canónica: no son equivalentes a la respuesta.
    # En integrales indefinidas, modificar SOLO el término constante no produce
    # una respuesta incorrecta: esa diferencia ya está absorbida por «+ C».
    # Por ello, los distractores de integrales alteran únicamente x, x², etc.
    indices = range(1, len(answer_coeffs)) if operation == "integrales" else range(len(answer_coeffs))
    for index in indices:
        for amount in (Fraction(1), Fraction(-1), Fraction(2)):
            changed = answer_coeffs.copy()
            changed[index] += amount
            text = polynomial_text(changed) + (" + C" if operation == "integrales" else "")
            if text != correct and text not in wrong:
                wrong.append(text)
    return Question(prompt, choices=_shuffle_options(correct, wrong, rng), correct_choice=correct)


def generate_question(operation: str, difficulty: str, fractions_mode: bool = False,
                      rng: Optional[random.Random] = None, level: int = 1) -> Question:
    if operation not in OPERATIONS or difficulty not in RULES or level < 1:
        raise ValueError("Operación, dificultad o nivel inválido")
    # Imposible comparte con Hard *todo* el generador hasta el nivel 10.
    # Desde el 11 emplea los parámetros matemáticos más exigentes.
    question_difficulty = "Hard" if difficulty == "Imposible" and level <= 10 else difficulty
    r = rng if rng is not None else random.Random()
    if operation in SYMBOLIC:
        return _symbolic_question(operation, question_difficulty, fractions_mode, r)

    if fractions_mode:
        a, b = _rational(question_difficulty, r), _rational(question_difficulty, r)
    else:
        x, y = _factors(question_difficulty, r)
        a, b = Fraction(x), Fraction(y)

    if operation == "suma":
        return Question(f"{fmt_number(a)} + {fmt_number(b)}", a + b)
    if operation == "resta":
        return Question(f"{fmt_number(a)} - {fmt_number(b)}", a - b)
    if operation == "multiplicacion":
        return Question(f"{fmt_number(a)} × {fmt_number(b)}", a * b)
    if operation == "division":
        if fractions_mode:
            return Question(f"({fmt_number(a)}) ÷ ({fmt_number(b)})", a / b)
        # División exacta, con resultado dentro de los factores propios del nivel.
        return Question(f"{fmt_number(a * b)} ÷ {fmt_number(b)}", a)
    if operation == "potencias":
        if fractions_mode:
            exponent = 2 if question_difficulty in ("Hard", "Imposible") else r.randint(2, 3)
            return Question(f"({fmt_number(a)})^{exponent}", a ** exponent)
        exponent = 2 if question_difficulty in ("Medium", "Hard") else r.randint(2, 3)
        return Question(f"{fmt_number(a)}^{exponent}", a ** exponent)
    if operation == "raices":
        # Raíces exactas; no existen aproximaciones ambiguas.
        return Question(f"√({fmt_number(a * a)})", abs(a))
    raise AssertionError("Operación no cubierta")


@dataclass
class FallingQuestion:
    ident: int
    question: Question
    lane: int
    distance: float = 0.0


@dataclass
class Engine:
    operation: str
    difficulty: str
    fractions_mode: bool = False
    infinite: bool = False
    seed: Optional[int] = None
    level: int = 1
    lives: int = LIVES
    score: int = 0
    streak: int = 0
    correct_in_level: int = 0
    total_correct: int = 0
    elapsed: float = 0.0
    state: str = "playing"
    falling: list[FallingQuestion] = field(default_factory=list)
    sequence: int = 0
    spawn_elapsed: float = 0.0
    fall_seconds: Optional[float] = None
    rng: random.Random = field(init=False, repr=False)

    def __post_init__(self):
        if self.operation not in OPERATIONS or self.difficulty not in RULES:
            raise ValueError("Operación o dificultad inválida")
        if self.infinite and self.difficulty == "Imposible":
            raise ValueError("Imposible no tiene modo infinito")
        if self.fall_seconds is not None and not 5 <= self.fall_seconds <= 120:
            raise ValueError("El tiempo de caída debe estar entre 5 y 120 segundos")
        self.rng = random.Random(self.seed)
        self.spawn()

    @property
    def symbolic(self) -> bool:
        return self.operation in SYMBOLIC

    @property
    def current_speed(self) -> float:
        return speed(self.difficulty, self.level, self.operation, self.fractions_mode)

    @property
    def current_fall_seconds(self) -> Optional[float]:
        """El ajuste es el tiempo inicial; después sigue la aceleración normal."""
        if self.fall_seconds is None:
            return None
        initial_speed = speed(self.difficulty, 1, self.operation, self.fractions_mode)
        return self.fall_seconds * initial_speed / self.current_speed

    def spawn(self) -> bool:
        if self.state != "playing":
            return False
        limit = 1 if self.symbolic else 2
        if len(self.falling) >= limit:
            return False
        lane = 0 if self.symbolic else self.rng.randrange(LANES)
        if not self.symbolic and any(f.lane == lane and f.distance < 75 for f in self.falling):
            lane = 1 - lane
            if any(f.lane == lane and f.distance < 75 for f in self.falling):
                return False
        self.sequence += 1
        self.falling.append(FallingQuestion(self.sequence, generate_question(
            self.operation, self.difficulty, self.fractions_mode, self.rng, level=self.level), lane))
        return True

    def advance(self, dt: float, drop_distance: float) -> None:
        if self.state != "playing" or dt <= 0:
            return
        dt = min(float(dt), 0.12)
        self.elapsed += dt
        self.spawn_elapsed += dt
        for f in self.falling[:]:
            velocity = drop_distance / self.current_fall_seconds if self.fall_seconds else self.current_speed
            f.distance += velocity * dt
            if f.distance >= drop_distance:
                self.falling.remove(f)
                self._lose_life()
                if self.state != "playing":
                    return
        interval = spawn_interval(self.difficulty, self.level)
        if self.fall_seconds:
            interval *= self.current_fall_seconds * self.current_speed / max(drop_distance, 1.0)
        if self.symbolic:
            interval = max(interval, 1.0)
        if not self.falling or self.spawn_elapsed >= interval:
            if self.spawn():
                self.spawn_elapsed = 0.0

    def _lose_life(self) -> None:
        self.lives = max(0, self.lives - 1)
        self.streak = 0
        if self.lives == 0:
            self.state = "lost"

    def _accept_correct(self, item: FallingQuestion) -> str:
        self.falling.remove(item)
        self.streak += 1
        self.total_correct += 1
        self.correct_in_level += 1
        bonus = min(5, self.streak // 5)
        self.score += (10 + 2 * bonus) * RULES[self.difficulty].score_weight * self.level
        if self.correct_in_level >= LEVEL_GOAL:
            self.correct_in_level = 0
            self.level += 1
            self.falling.clear()
            self.spawn_elapsed = 0.0
            if not self.infinite and self.level > RULES[self.difficulty].levels:
                self.level = RULES[self.difficulty].levels
                self.state = "won"
                return "won"
            self.spawn()
            return "level_up"
        # La siguiente pregunta aparece sin depender del próximo fotograma.
        self.spawn()
        return "correct"

    def submit(self, raw: str) -> str:
        """Respuestas: correct, incorrect, invalid, level_up, won, inactive."""
        if self.state != "playing":
            return "inactive"
        if not self.falling:
            return "inactive"
        if self.symbolic:
            target = max(self.falling, key=lambda f: f.distance)
            if raw not in target.question.choices:
                return "invalid"
            if raw == target.question.correct_choice:
                return self._accept_correct(target)
            self.falling.remove(target)
            self._lose_life()
            self.spawn()
            return "incorrect"
        number = parse_number(raw)
        if number is None:
            return "invalid"
        matching = [f for f in self.falling if f.question.answer == number]
        if matching:
            return self._accept_correct(max(matching, key=lambda f: f.distance))
        self.falling.remove(max(self.falling, key=lambda f: f.distance))
        self._lose_life()
        self.spawn()
        return "incorrect"

    def toggle_pause(self) -> None:
        if self.state == "playing":
            self.state = "paused"
        elif self.state == "paused":
            self.state = "playing"
