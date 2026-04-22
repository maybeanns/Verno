
import sys
import subprocess
import json

# Auto-install dependencies
def ensure_deps():
    deps = ["kokoro", "sounddevice", "numpy"]
    for dep in deps:
        try:
            __import__(dep)
        except ImportError:
            subprocess.check_call([sys.executable, "-m", "pip", "install", dep, "-q"])

ensure_deps()

import numpy as np
import sounddevice as sd
from http.server import HTTPServer, BaseHTTPRequestHandler
from kokoro import KPipeline
import time
import threading
import os

last_heartbeat = time.time()

def heartbeat_monitor():
    global last_heartbeat
    while True:
        time.sleep(5)
        if time.time() - last_heartbeat > 30:
            print("No heartbeat for 30s. Self-destructing.", flush=True)
            os._exit(0)

pipeline = KPipeline(lang_code='a')
VOICE = 'af_heart'
SPEED = 1.1

class TTSHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Silence all logs

    def do_POST(self):
        if self.path == '/speak':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length)
                data = json.loads(body)
                text = data.get('text', '')

                if text.strip():
                    generator = pipeline(text, voice=VOICE, speed=SPEED)
                    audio_parts = []
                    for _, _, audio in generator:
                        if audio is not None:
                            audio_parts.append(audio)
                    if audio_parts:
                        full_audio = np.concatenate(audio_parts)
                        sd.play(full_audio, samplerate=24000)
                        sd.wait()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            global last_heartbeat
            last_heartbeat = time.time()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ready"}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    t = threading.Thread(target=heartbeat_monitor, daemon=True)
    t.start()
    server = HTTPServer(('127.0.0.1', 9872), TTSHandler)
    server.serve_forever()
