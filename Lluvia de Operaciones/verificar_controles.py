import sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from main import MathRainApp, Window
from math_engine import Engine, fmt_number
from kivy.clock import Clock
for duration in (5,15,60):
    e=Engine('suma','Easy',fall_seconds=duration)
    card=e.falling[0]
    for _ in range(20): e.advance(.1,300)
    assert abs(card.distance-300*2/duration)<1e-6
for invalid in (0,121,float('nan')):
    try: Engine('suma','Easy',fall_seconds=invalid)
    except ValueError: pass
    else: raise AssertionError('invalid duration accepted')
class CheckApp(MathRainApp):
    @property
    def user_data_dir(self): return folder
    def on_start(self): Clock.schedule_once(self.check,.2)
    def check(self,dt):
        self.show_settings()
        self.set_fall_seconds(30)
        assert self._read_fall_seconds()==30
        self.show_menu()
        self.show_difficulties('suma')
        self.show_start_options('Easy')
        self.start_game(False)
        assert self.engine.fall_seconds==30
        def press(code): Window.dispatch('on_key_down',code,0,'',[])
        press(49); Window.dispatch('on_textinput','1'); press(258)
        assert self.entry=='12',self.entry
        press(8); assert self.entry=='1'
        press(127); assert self.entry==''
        Window.dispatch('on_textinput','23'); assert self.entry=='23'
        press(127)
        press(269);press(259);press(267);press(260)
        assert self.entry=='-3/4',self.entry
        press(127)
        answer=fmt_number(self.engine.falling[0].question.answer)
        for ch in answer: press(ord(ch))
        press(271); assert self.engine.total_correct==1
        press(112); assert self.engine.state=='paused'
        press(49); assert self.entry==''
        press(27); assert self.engine.state=='playing'
        self.exit_game()
        self.show_difficulties('derivadas'); self.show_start_options('Easy'); self.start_game(False)
        q=self.engine.falling[0].question
        press(257+q.choices.index(q.correct_choice))
        assert self.engine.total_correct==1
        self.exit_game();self.show_settings();self.set_fall_seconds(None)
        assert self._read_fall_seconds() is None
        press(27); assert self.page=='menu'
        print('PASS: keyboard, numpad, Enter, backspace, delete, pause, symbolic choices, timing, settings persistence and reset')
        self.stop()
with tempfile.TemporaryDirectory() as folder: CheckApp().run()

