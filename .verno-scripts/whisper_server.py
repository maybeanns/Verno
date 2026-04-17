
import sys
import subprocess
import json
import tempfile
import os

# Auto-install faster-whisper
try:
    from faster_whisper import WhisperModel
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "faster-whisper", "-q"])
    from faster_whisper import WhisperModel

from http.server import HTTPServer, BaseHTTPRequestHandler

model = WhisperModel("base", device="cpu", compute_type="int8")

class WhisperHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Silence all logs

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            audio_bytes = self.rfile.read(length)

            # Write to temp file
            tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            tmp.write(audio_bytes)
            tmp.close()

            try:
                segments, _ = model.transcribe(tmp.name, beam_size=5)
                text = " ".join([seg.text for seg in segments]).strip()
            finally:
                os.unlink(tmp.name)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"text": text}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ready"}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 9871), WhisperHandler)
    server.serve_forever()
