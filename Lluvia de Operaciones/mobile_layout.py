"""Cálculos independientes de Kivy para la interfaz móvil.

Kivy 2.x no expone de forma universal la zona segura de iOS; en versiones
que sí la exponen, se utilizan los valores del sistema. En versiones
anteriores se aplica un margen conservador que deberá verificarse en iPhone.
"""
from __future__ import annotations
from collections.abc import Mapping


def safe_insets(platform: str, window_height: float,
                reported: Mapping[str, float] | None = None) -> dict[str, float]:
    """Devuelve márgenes lógicos de la zona segura, en puntos Kivy.

    En escritorio/Android no se cambian los márgenes de la aplicación original.
    La cifra de reserva en iOS es provisional: validar en teléfonos con
    Dynamic Island, notch, botón Home y modo horizontal si se habilita.
    """
    if platform != "ios":
        return {side: 0.0 for side in ("top", "right", "bottom", "left")}
    height = max(1.0, float(window_height))
    fallback = {
        "top": min(54.0, max(28.0, height * 0.067)),
        "bottom": min(34.0, max(16.0, height * 0.04)),
        "left": 0.0,
        "right": 0.0,
    }
    if reported is None or not isinstance(reported, Mapping):
        return fallback
    result = fallback.copy()
    for side in result:
        v = reported.get(side)
        if isinstance(v, (int, float)) and 0 <= v <= height / 3:
            # Algunos backends antiguos informan cero antes de calcular insets;
            # mantenemos el margen conservador en ese caso.
            if v > 0 or side in ("left", "right"):
                result[side] = float(v)
    return result


def control_dimensions(window_height: float, symbolic: bool) -> dict[str, int]:
    """Medidas del teclado/opciones para iPhone SE y teléfonos grandes."""
    compact = window_height < 740
    if symbolic:
        choice_height = 45 if compact else 52
        return {"option_height": choice_height, "container_height": 4 * choice_height + 3 * 5 + 3}
    key_height = 37 if compact else 43
    label_height = 34 if compact else 41
    return {"key_height": key_height,
            "label_height": label_height,
            "container_height": label_height + 4 * key_height + 3 * 5 + 12}
