#!/usr/bin/env python3
"""
Play alert: short notification beeps (pygame) followed by voice warning (pyttsx3).
Usage: python alert_audio.py --name "John" --type low|high|rapid_rise|rapid_fall|stale [--value 3.2]
"""
import argparse
import json
import sys
import wave
import math
import struct
import tempfile
import os


def generate_beep_wav(freq=880, duration_ms=200, sample_rate=44100):
    """Generate a short beep as WAV bytes."""
    n_samples = int(sample_rate * duration_ms / 1000)
    samples = []
    for i in range(n_samples):
        t = i / sample_rate
        # Simple sine wave with fade
        val = 0.3 * math.sin(2 * math.pi * freq * t)
        samples.append(struct.pack('h', int(32767 * val)))
    wav_data = b''.join(samples)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        with wave.open(f.name, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(wav_data)
        return f.name


def play_beeps(num_beeps=3):
    """Play short beeps using pygame."""
    try:
        import pygame
        pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
        beep_path = generate_beep_wav(freq=880, duration_ms=150)
        try:
            sound = pygame.mixer.Sound(beep_path)
            for _ in range(num_beeps):
                sound.play()
                pygame.time.wait(200)
            pygame.time.wait(300)
        finally:
            try:
                os.unlink(beep_path)
            except OSError:
                pass
        pygame.mixer.quit()
    except ImportError:
        # Fallback: winsound on Windows
        if sys.platform == 'win32':
            try:
                import winsound
                for _ in range(num_beeps):
                    winsound.Beep(880, 150)
                    import time
                    time.sleep(0.2)
            except Exception:
                pass


def speak_message(name, alert_type, value=None):
    """Speak the alert message using pyttsx3."""
    messages = {
        'low': f"Hey {name}, your blood sugar is low",
        'high': f"Hey {name}, your blood sugar is high",
        'rapid_rise': f"Hey {name}, your blood sugar is rising quickly",
        'rapid_fall': f"Hey {name}, your blood sugar is falling quickly",
        'stale': f"Hey {name}, there has been no new glucose reading. Please check your sensor.",
    }
    msg = messages.get(alert_type, f"Hey {name}, glucose alert")
    if value is not None and alert_type in ('low', 'high'):
        msg += f". Current reading is {value}"
    msg += ". Please check your glucose."

    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)
        engine.say(msg)
        engine.runAndWait()
    except ImportError:
        pass  # pyttsx3 not installed
    except Exception:
        pass  # TTS failed (e.g. no audio device)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', default='User', help='User name for voice greeting')
    parser.add_argument('--type', required=True, choices=['low', 'high', 'rapid_rise', 'rapid_fall', 'stale'])
    parser.add_argument('--value', type=float, help='Current BG value for context')
    args = parser.parse_args()

    play_beeps(3)
    speak_message(args.name, args.type, args.value)


if __name__ == '__main__':
    main()
