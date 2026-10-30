"""Lluvia Matemática: interfaz táctil Kivy para iPhone, Android y escritorio.

iOS: el empaquetado requiere macOS, kivy-ios y Xcode.
Android: se empaqueta con Buildozer en Linux/WSL2.
Windows: ejecuta `python main.py` tras instalar Kivy.
El juego NO realiza peticiones de red.
"""
__version__ = "3.1.0"

from kivy.utils import platform as kivy_platform
from kivy.config import Config
if kivy_platform not in ("android", "ios"):
    Config.set("graphics", "width", "500")
    Config.set("graphics", "height", "700")
    Config.set("graphics", "resizable", "1")

from pathlib import Path
import json
from time import monotonic

from kivy.app import App
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.graphics import Color, RoundedRectangle, Rectangle
from kivy.metrics import dp, sp
from mobile_layout import safe_insets, control_dimensions
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.slider import Slider

from math_engine import DIFFICULTIES, LEVEL_GOAL, LIVES, OPERATIONS, RULES, Engine

BG = (0.043, 0.071, 0.13, 1)
PANEL = (0.084, 0.13, 0.22, 1)
BOARD = (0.055, 0.105, 0.18, 1)
TEXT = (0.92, 0.96, 1, 1)
MUTED = (0.62, 0.69, 0.8, 1)
AQUA = (0.20, 0.84, 0.76, 1)
GOLD = (0.99, 0.72, 0.36, 1)
RED = (1.0, 0.37, 0.50, 1)


def button(text: str, callback, *, accent=AQUA, height=56, font=17) -> Button:
    btn = Button(
        text={"✓": "OK", "⌫": "BOR"}.get(text, text.replace("➜", ">")), size_hint_y=None, height=dp(height), font_size=sp(font), bold=True,
        background_normal="", background_down="", background_color=accent,
        color=BG if accent in (AQUA, GOLD) else TEXT,
        halign="center", valign="middle", shorten=False,
    )
    btn.bind(size=lambda obj, _size: setattr(obj, "text_size", (obj.width - dp(12), obj.height - dp(5))))
    btn.bind(on_release=lambda *_: callback())
    return btn


def text_label(text: str, size=18, color=TEXT, height=None, bold=False) -> Label:
    kw = {"text": text, "color": color, "font_size": sp(size), "bold": bold,
          "halign": "center", "valign": "middle"}
    if height is not None:
        kw.update(size_hint_y=None, height=dp(height))
    label = Label(**kw)
    label.bind(size=lambda obj, _size: setattr(obj, "text_size", (obj.width - dp(12), obj.height)))
    return label


class FallingCard(Label):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.color = TEXT
        self.bold = True
        self.halign = "center"
        self.valign = "middle"
        with self.canvas.before:
            Color(*PANEL)
            self.bg_rect = RoundedRectangle(pos=self.pos, size=self.size, radius=[dp(11)])
        self.bind(pos=self._sync, size=self._sync)

    def _sync(self, *_):
        self.bg_rect.pos = self.pos
        self.bg_rect.size = self.size
        self.text_size = (self.width - dp(9), self.height - dp(5))


class RainBoard(FloatLayout):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.cards: dict[int, FallingCard] = {}
        with self.canvas.before:
            Color(*BOARD)
            self.rect = Rectangle(pos=self.pos, size=self.size)
        with self.canvas.after:
            Color(*RED)
            self.ground = Rectangle(pos=(self.x, self.y + dp(6)), size=(self.width, dp(5)))
        self.bind(pos=self._geometry, size=self._geometry)

    def _geometry(self, *_):
        self.rect.pos = self.pos
        self.rect.size = self.size
        self.ground.pos = (self.x, self.y + dp(6))
        self.ground.size = (self.width, dp(5))

    def display(self, engine: Engine):
        live = {f.ident for f in engine.falling}
        for old in list(self.cards):
            if old not in live:
                self.remove_widget(self.cards.pop(old))
        for drop in engine.falling:
            card = self.cards.get(drop.ident)
            if card is None:
                card = FallingCard(text=drop.question.text, size_hint=(None, None))
                self.cards[drop.ident] = card
                self.add_widget(card)
            symbolic = engine.symbolic
            width = self.width * (0.94 if symbolic else 0.47)
            height = dp(88 if symbolic else 54)
            center_x = self.center_x if symbolic else self.x + self.width * (0.25 if drop.lane == 0 else 0.75)
            card.size = (width, height)
            card.pos = (center_x - width / 2, self.top - dp(8) - height - dp(drop.distance))
            n = len(drop.question.text)
            card.font_size = sp(12 if n > 65 else 14 if n > 35 else 17 if n > 16 else 20)


class MathRainApp(App):
    title = "Lluvia Matemática"

    def build(self):
        Window.clearcolor = BG
        self.engine = None
        self.page = "menu"
        self.fractions = False
        self.operation = "multiplicacion"
        self.difficulty = "Easy"
        self.infinite = False
        self.entry = ""
        self.records = self._read_records()
        self.fall_seconds = self._read_fall_seconds()
        self.root_box = BoxLayout(orientation="vertical")
        self._apply_safe_area()
        Window.bind(size=self._window_changed)
        # Disponible únicamente en backends recientes de Kivy; iOS antiguo
        # conserva márgenes de seguridad calculados en mobile_layout.py.
        if hasattr(Window, "safe_area"):
            Window.bind(safe_area=self._safe_area_changed)
        self.status_text = None
        self.entry_label = None
        self.choice_box = None
        self.last_choice_id = None
        self.board = None
        self.pause_btn = None
        self.notice_text = ""
        self._last_key_text = ("", 0.0)
        Window.bind(on_key_down=self.on_key, on_textinput=self.on_text_input)
        Clock.schedule_interval(self.frame, 1 / 30)
        self.show_menu(False)
        return self.root_box

    def _apply_safe_area(self):
        insets = safe_insets(
            kivy_platform, Window.height,
            getattr(Window, "safe_area", None),
        )
        self.root_box.padding = [
            insets["left"], insets["top"],
            insets["right"], insets["bottom"],
        ]

    def _window_changed(self, *_):
        self._apply_safe_area()

    def _safe_area_changed(self, *_):
        self._apply_safe_area()

    def _read_fall_seconds(self):
        try:
            value = json.loads((Path(self.user_data_dir) / "settings.json").read_text(encoding="utf-8")).get("fall_seconds")
            if value is None:
                return None
            if isinstance(value, (int, float)) and not isinstance(value, bool) and 5 <= value <= 120:
                return float(value)
        except (OSError, ValueError, TypeError, AttributeError):
            pass
        return None

    def set_fall_seconds(self, value):
        self.fall_seconds = None if value is None else float(value)
        self.settings_label.text = (
            "Automático: aumenta la velocidad por nivel" if value is None else
            f"Primer nivel: {self.fall_seconds:g} segundos por ejercicio")
        try:
            path = Path(self.user_data_dir)
            path.mkdir(parents=True, exist_ok=True)
            (path / "settings.json").write_text(
                json.dumps({"fall_seconds": self.fall_seconds}), encoding="utf-8")
            self.settings_notice.text = "Guardado. Se aplicará a la próxima partida."
        except OSError:
            self.settings_notice.text = "Aplicado, pero no se pudo guardar en este equipo."

    def show_settings(self):
        self.page = "settings"
        base = self._base("CONFIGURACIÓN", lambda: self.show_menu(self.fractions))
        base.add_widget(text_label("TIEMPO DE CAÍDA", height=45, bold=True))
        self.settings_label = text_label(
            "Automático: aumenta la velocidad por nivel" if self.fall_seconds is None else
            f"Primer nivel: {self.fall_seconds:g} segundos por ejercicio", size=16, height=55)
        base.add_widget(self.settings_label)
        base.add_widget(text_label("Más segundos = más tiempo para responder.\nLa caída acelera al subir de nivel.", size=15, height=65))
        slider = Slider(min=5, max=120, step=1, value=self.fall_seconds or 30,
                        size_hint_y=None, height=dp(55))
        slider.bind(value=lambda _, value: self.set_fall_seconds(value))
        base.add_widget(slider)
        base.add_widget(text_label("5 s                              120 s", size=15, height=30))
        base.add_widget(button("USAR TIEMPO INICIAL", lambda: self.set_fall_seconds(slider.value), height=48))
        base.add_widget(button("RESTAURAR AUTOMÁTICO", lambda: self.set_fall_seconds(None), accent=PANEL, height=48, font=15))
        self.settings_notice = text_label("Elige un tiempo o conserva el modo automático.", size=14, color=GOLD, height=50)
        base.add_widget(self.settings_notice)
        base.add_widget(text_label("TECLADO\nNúmeros y teclado numérico · Enter: responder\nRetroceso: borrar · Supr: limpiar\nEsc o P: pausa · Opciones: 1, 2, 3, 4\nHaz clic en la ventana del juego para usarlo.", size=14))

    def _read_records(self):
        path = Path(self.user_data_dir) / "records.json"
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return {str(k): int(v) for k, v in data.items() if int(v) >= 0} if isinstance(data, dict) else {}
        except (OSError, ValueError, TypeError):
            return {}

    def _save_record(self):
        if not self.engine:
            return False
        key = f"{'frac' if self.fractions else 'normal'}:{self.operation}:{self.difficulty}:{'infinito' if self.infinite else 'campaña'}"
        if self.engine.fall_seconds is not None:
            key += f":inicio-progresivo-{self.engine.fall_seconds:g}s"
        high = self.records.get(key, 0)
        if self.engine.score <= high:
            return False
        self.records[key] = self.engine.score
        try:
            path = Path(self.user_data_dir)
            path.mkdir(parents=True, exist_ok=True)
            (path / "records.json").write_text(json.dumps(self.records, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError:
            pass  # La partida no debe fallar por problemas de almacenamiento.
        return True

    def _base(self, heading: str, back=None):
        self.root_box.clear_widgets()
        base = BoxLayout(orientation="vertical", padding=[dp(14), dp(10), dp(14), dp(12)], spacing=dp(10))
        header = BoxLayout(size_hint_y=None, height=dp(52), spacing=dp(6))
        if back:
            go_back = button("‹", back, accent=PANEL, height=48, font=26)
            go_back.size_hint_x = None
            go_back.width = dp(55)
            header.add_widget(go_back)
        title = text_label(heading, size=17 if len(heading) >= 15 and back else 22, bold=True)
        header.add_widget(title)
        if back:
            balance = text_label("", size=10)
            balance.size_hint_x = None
            balance.width = dp(55)
            header.add_widget(balance)
        base.add_widget(header)
        self.root_box.add_widget(base)
        return base

    def _scroll_actions(self, actions, cols=2):
        scroller = ScrollView(do_scroll_x=False)
        grid = GridLayout(cols=cols, spacing=dp(8), size_hint_y=None, padding=[dp(2), dp(3)])
        grid.bind(minimum_height=grid.setter("height"))
        for label, on_press, accent in actions:
            grid.add_widget(button(label, on_press, accent=accent, height=78, font=15))
        scroller.add_widget(grid)
        return scroller

    def show_menu(self, fractions_mode=False):
        self._save_record() if self.engine else None
        self.engine = None
        self.page = "menu"
        self.fractions = fractions_mode
        base = self._base("FRACCIONES" if fractions_mode else "LLUVIA MATEMÁTICA",
                          (lambda: self.show_menu(False)) if fractions_mode else None)
        base.add_widget(text_label(
            "Elige una operación de fracciones" if fractions_mode else "Elige qué quieres practicar",
            size=15, color=MUTED, height=50))
        actions = [(name, (lambda op=key: self.show_difficulties(op)), PANEL)
                   for key, name in OPERATIONS.items()]
        if not fractions_mode:
            actions.append(("FRACCIONES  ➜", lambda: self.show_menu(True), GOLD))
        base.add_widget(self._scroll_actions(actions))
        base.add_widget(button("CONFIGURACIÓN", self.show_settings, accent=PANEL, height=45, font=16))
        base.add_widget(button("¿CÓMO SE JUEGA?", self.show_help, accent=AQUA, height=53, font=16))

    def show_help(self):
        self.page = "help"
        base = self._base("INSTRUCCIONES", lambda: self.show_menu(self.fractions))
        helptext = (
            "Cada ejercicio cae hacia la línea roja. ¡Resuélvelo antes de que llegue!\n\n"
            "• Para números, escribe el resultado con el teclado físico o el del juego.\n"
            "• Para fracciones, usa el formato 3/4 o -5/2.\n"
            "• Factorización, derivadas e integrales ofrecen cuatro opciones.\n"
            "• Cada acierto suma puntos; cada fallo cuesta una vida.\n"
            "• 10 aciertos completan un nivel; comienzas con 3 vidas.\n"
            "• Easy, Medium y Hard: 10 niveles o modo infinito.\n"
            "• Imposible: 20 niveles y sin infinito.\n"
            "• Pausa disponible durante la partida.\n\n"
            "Los ejercicios se generan dentro del dispositivo. No se necesita internet."
        )
        scroll = ScrollView()
        body = text_label(helptext, size=16, color=TEXT)
        body.size_hint_y = None
        body.height = dp(500)
        scroll.add_widget(body)
        base.add_widget(scroll)

    def show_difficulties(self, operation):
        self.operation = operation
        self.page = "difficulty"
        base = self._base(OPERATIONS[operation].upper(), lambda: self.show_menu(self.fractions))
        base.add_widget(text_label("Selecciona una dificultad", color=MUTED, height=45, size=16))
        for name in DIFFICULTIES:
            rule = RULES[name]
            description = f"{name.upper()}     ·     {rule.levels} niveles"
            base.add_widget(button(description, lambda d=name: self.show_start_options(d),
                                   accent=GOLD if name == "Imposible" else PANEL, height=66))
        base.add_widget(text_label("La velocidad aumenta en cada nivel." if self.fall_seconds is None else f"Tiempo inicial: {self.fall_seconds:g} segundos por ejercicio.", color=MUTED, size=15))

    def show_start_options(self, difficulty):
        self.difficulty = difficulty
        self.page = "start"
        base = self._base("INICIAR PARTIDA", lambda: self.show_difficulties(self.operation))
        subtitle = f"{'Fracciones · ' if self.fractions else ''}{OPERATIONS[self.operation]} · {difficulty}"
        base.add_widget(text_label(subtitle, size=19, color=GOLD))
        base.add_widget(button("CAMPAÑA", lambda: self.start_game(False), height=82, font=23))
        if difficulty != "Imposible":
            base.add_widget(button("MODO INFINITO ∞", lambda: self.start_game(True),
                                   accent=PANEL, height=82, font=20))
        base.add_widget(text_label("3 vidas · 10 aciertos por nivel", color=MUTED, size=16))

    def start_game(self, infinite):
        self.infinite = infinite
        self.engine = Engine(self.operation, self.difficulty, self.fractions, infinite, fall_seconds=self.fall_seconds)
        self.entry = ""
        self.last_choice_id = None
        self.notice_text = ""
        self.page = "game"
        self.root_box.clear_widgets()
        screen = BoxLayout(orientation="vertical", spacing=dp(7), padding=[dp(9), dp(5), dp(9), dp(9)])
        top = BoxLayout(size_hint_y=None, height=dp(44), spacing=dp(5))
        top.add_widget(button("MENÚ", self.exit_game, accent=PANEL, height=43, font=14))
        self.pause_btn = button("PAUSA", self.pause_toggle, accent=GOLD, height=43, font=14)
        top.add_widget(self.pause_btn)
        screen.add_widget(top)
        self.status_text = text_label("", size=15, color=TEXT, height=75, bold=True)
        screen.add_widget(self.status_text)
        self.board = RainBoard()
        screen.add_widget(self.board)
        self.message = text_label("", size=14, color=AQUA, height=27)
        screen.add_widget(self.message)
        sizes = control_dimensions(Window.height, self.engine.symbolic)
        if self.engine.symbolic:
            self.entry_label = None
            self.choice_box = BoxLayout(orientation="vertical", size_hint_y=None,
                                        height=dp(sizes["container_height"]), spacing=dp(5))
            screen.add_widget(self.choice_box)
        else:
            self.choice_box = None
            control = BoxLayout(orientation="vertical", size_hint_y=None,
                                height=dp(sizes["container_height"]), spacing=dp(4))
            self.entry_label = text_label("RESPUESTA: _", size=20, color=GOLD,
                                          height=sizes["label_height"], bold=True)
            control.add_widget(self.entry_label)
            keys = GridLayout(cols=4, spacing=dp(5))
            for symbol in ("7", "8", "9", "⌫", "4", "5", "6", "/",
                           "1", "2", "3", "-", "C", "0", "+/-", "✓"):
                keys.add_widget(button(symbol, lambda char=symbol: self.keypad(char),
                                       accent=AQUA if symbol == "✓" else PANEL,
                                       height=sizes["key_height"], font=21))
            control.add_widget(keys)
            screen.add_widget(control)
        self.root_box.add_widget(screen)
        self.refresh_view()

    def exit_game(self):
        self._save_record()
        self.engine = None
        self.show_menu(self.fractions)

    def pause_toggle(self):
        if self.engine and self.page == "game":
            self.engine.toggle_pause()
            self.refresh_view()

    def keypad(self, char):
        if not self.engine or self.engine.state != "playing":
            return
        if char == "✓":
            result = self.engine.submit(self.entry)
            if result == "invalid":
                self.notice_text = "Introduce un número válido (ej.: -3/4)."
            else:
                self.entry = ""
                self.after_answer(result)
        elif char == "⌫":
            self.entry = self.entry[:-1]
        elif char == "C":
            self.entry = ""
        elif char == "+/-":
            self.entry = self.entry[1:] if self.entry.startswith("-") else "-" + self.entry
        elif len(self.entry) < 19:
            if char == "/" and ("/" in self.entry or not self.entry or self.entry == "-"):
                return
            if char == "-" and self.entry:
                return
            self.entry += char
        self.refresh_view()

    def choose(self, answer):
        if self.engine and self.engine.state == "playing":
            self.after_answer(self.engine.submit(answer))
            self.refresh_view()

    def after_answer(self, outcome):
        if outcome == "correct":
            self.notice_text = "¡Correcto! + puntos"
        elif outcome == "incorrect":
            self.notice_text = "Respuesta incorrecta: -1 vida"
        elif outcome == "level_up":
            self.notice_text = "¡NIVEL SUPERADO! Más velocidad"
        elif outcome == "won":
            self.end_game(True)
        if self.engine and self.engine.state == "lost":
            self.end_game(False)

    def frame(self, dt):
        if self.page != "game" or not self.engine:
            return
        if self.engine.state == "playing" and self.board and self.board.height > dp(120):
            travel = max(100.0, (self.board.height - dp(102 if self.engine.symbolic else 82)) / dp(1))
            self.engine.advance(dt, travel)
            if self.engine.state == "lost":
                self.end_game(False)
                return
        self.refresh_view()

    def refresh_view(self):
        if self.page != "game" or not self.engine:
            return
        e = self.engine
        if self.board:
            self.board.display(e)
        if self.status_text:
            stage = "∞" if e.infinite else f"/{RULES[e.difficulty].levels}"
            self.status_text.text = (f"{OPERATIONS[e.operation]}  ·  {e.difficulty}\n"
                                     f"Nivel {e.level}{stage}  |  Aciertos {e.correct_in_level}/{LEVEL_GOAL}"
                                     f"  |  Vidas {e.lives}/{LIVES}  |  Puntos {e.score}")
        if e.current_fall_seconds is not None:
            self.status_text.text += f"\nCaída: {e.current_fall_seconds:.1f} s"
        if self.message:
            self.message.text = "PAUSA" if e.state == "paused" else self.notice_text
        if self.pause_btn:
            self.pause_btn.text = "SEGUIR" if e.state == "paused" else "PAUSA"
        if self.entry_label:
            self.entry_label.text = "RESPUESTA: " + (self.entry if self.entry else "_")
        if self.choice_box is not None and e.symbolic:
            ident = e.falling[0].ident if e.falling else None
            if ident != self.last_choice_id:
                self.last_choice_id = ident
                self.choice_box.clear_widgets()
                if e.falling:
                    for idx, answer in enumerate(e.falling[0].question.choices):
                        label = f"{idx + 1}. {answer}"
                        fontsize = 13 if len(label) > 35 else 15
                        self.choice_box.add_widget(button(label, lambda a=answer: self.choose(a),
                                                          accent=PANEL,
                                                          height=control_dimensions(Window.height, True)["option_height"],
                                                          font=fontsize))

    def end_game(self, victory):
        if not self.engine:
            return
        new_record = self._save_record()
        e = self.engine
        self.page = "result"
        base = self._base("¡CAMPAÑA COMPLETA!" if victory else "FIN DE PARTIDA")
        base.add_widget(text_label("Nuevo récord personal" if new_record else "Resultado de tu partida",
                                   size=19, color=GOLD))
        base.add_widget(text_label(
            f"{OPERATIONS[e.operation]} · {e.difficulty}\n"
            f"PUNTUACIÓN: {e.score}\n"
            f"NIVEL: {e.level}\n"
            f"ACIERTOS: {e.total_correct}", size=24, bold=True))
        base.add_widget(button("VOLVER A JUGAR", lambda: self.start_game(self.infinite), height=72))
        base.add_widget(button("MENÚ PRINCIPAL", lambda: self.show_menu(self.fractions),
                               accent=PANEL, height=65))

    def on_text_input(self, _window, text):
        if self.page != "game":
            return False
        previous, when = self._last_key_text
        self._last_key_text = ("", 0.0)
        if text == previous and monotonic() - when < 0.25:
            return True  # SDL puede emitir keydown y textinput para la misma tecla.
        for char in text:
            if char in "0123456789/-":
                self.on_key(_window, ord(char), 0, char, [])
                self._last_key_text = ("", 0.0)
        return True

    def on_key(self, _window, keycode, _scancode, text, _modifiers):
        if isinstance(keycode, (tuple, list)):
            keycode = keycode[0]
        if any(m in (_modifiers or []) for m in ("ctrl", "alt", "meta")):
            return False
        # SDL2 puede enviar codepoint vacío; usar también el código de tecla.
        if not text or keycode in range(256, 272):
            if 48 <= keycode <= 57:
                text = chr(keycode)
            elif 256 <= keycode <= 265:
                text = str(keycode - 256)
            else:
                text = {45: "-", 47: "/", 267: "/", 269: "-"}.get(keycode, "")
        if keycode == 27:
            if self.page == "game":
                self.pause_toggle()
            elif self.page == "menu" and self.fractions:
                self.show_menu(False)
            elif self.page in ("help", "settings"):
                self.show_menu(self.fractions)
            elif self.page == "difficulty":
                self.show_menu(self.fractions)
            elif self.page == "start":
                self.show_difficulties(self.operation)
            elif self.page == "result":
                self.show_menu(self.fractions)
            else:
                return False
            return True
        if self.page != "game":
            return False
        if keycode in (112, 80):
            self.pause_toggle()
            return True
        if keycode == 127:
            self.keypad("C")
            return True
        if self.engine and self.engine.symbolic:
            if text in ("1", "2", "3", "4") and self.engine.falling:
                self._last_key_text = (text, monotonic())
                index = int(text) - 1
                self.choose(self.engine.falling[0].question.choices[index])
                return True
            return False
        if keycode in (13, 271):
            self.keypad("✓")
            return True
        if keycode == 8:
            self.keypad("⌫")
            return True
        if text and text in "0123456789/-":
            self._last_key_text = (text, monotonic())
            self.keypad(text)
            return True
        return False

    def on_pause(self):
        if self.engine and self.engine.state == "playing":
            self.engine.toggle_pause()
        # iOS puede terminar apps suspendidas sin volver a on_stop.
        self._save_record()
        return True

    def on_resume(self):
        # En iPhone la partida permanece pausada al volver a la app; el jugador
        # la reanuda explícitamente, evitando que pierda vidas mientras vuelve.
        self._apply_safe_area()
        self.refresh_view()

    def on_stop(self):
        self._save_record()


if __name__ == "__main__":
    MathRainApp().run()


