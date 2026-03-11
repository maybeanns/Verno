import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';

const TTS_PORT = 9872;

const PYTHON_TTS_SERVER = `
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
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ready"}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', ${TTS_PORT}), TTSHandler)
    server.serve_forever()
`;

export class TTSService {
    private process: ChildProcess | null = null;
    private ready: boolean = false;
    private scriptPath: string = '';

    public async initialize(extensionPath: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('verno');
        const ttsEnabled = config.get<boolean>('ttsEnabled', true);
        if (!ttsEnabled) {
            console.log('[TTSService] TTS disabled via settings');
            return;
        }

        try {
            // Write the Python script to disk
            const scriptsDir = path.join(extensionPath, '.verno-scripts');
            if (!fs.existsSync(scriptsDir)) {
                fs.mkdirSync(scriptsDir, { recursive: true });
            }
            this.scriptPath = path.join(scriptsDir, 'tts_server.py');
            fs.writeFileSync(this.scriptPath, PYTHON_TTS_SERVER, 'utf-8');

            // Find Python
            const pythonPath = await this.findPython();
            if (!pythonPath) {
                console.log('[TTSService] Python not found, TTS unavailable');
                return;
            }

            // Spawn the process
            this.process = spawn(pythonPath, [this.scriptPath], {
                stdio: 'ignore',
                detached: false
            });

            this.process.on('error', (err) => {
                console.error('[TTSService] Process error:', err.message);
                this.ready = false;
            });

            this.process.on('exit', (code) => {
                console.log(`[TTSService] Process exited with code ${code}`);
                this.ready = false;
            });

            // Wait for the model to load
            await this.waitForReady(15000);
        } catch (err) {
            console.error('[TTSService] Initialization failed:', err);
        }
    }

    private async findPython(): Promise<string | null> {
        const candidates = ['python3', 'python', 'py'];
        for (const cmd of candidates) {
            try {
                const proc = spawn(cmd, ['--version'], { stdio: 'pipe' });
                const exitCode = await new Promise<number>((resolve) => {
                    proc.on('exit', (code) => resolve(code ?? 1));
                    proc.on('error', () => resolve(1));
                });
                if (exitCode === 0) return cmd;
            } catch {
                continue;
            }
        }
        return null;
    }

    private async waitForReady(timeoutMs: number): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const resp = await fetch(`http://127.0.0.1:${TTS_PORT}/health`);
                if (resp.ok) {
                    this.ready = true;
                    console.log('[TTSService] Server ready');
                    return;
                }
            } catch {
                // Server not up yet
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('[TTSService] Server did not become ready in time');
    }

    public async speak(text: string): Promise<void> {
        if (!text || text.trim().length === 0) return;

        if (this.ready) {
            try {
                const resp = await fetch(`http://127.0.0.1:${TTS_PORT}/speak`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });
                if (resp.ok) return;
            } catch (err) {
                console.error('[TTSService] Speak failed, falling back:', err);
            }
        }

        // Fallback: show as VS Code status bar message
        vscode.window.setStatusBarMessage(`🔊 ${text}`, 5000);
    }

    public dispose(): void {
        if (this.process) {
            try {
                this.process.kill();
            } catch {
                // Process may have already exited
            }
            this.process = null;
        }
        this.ready = false;

        // Clean up script file
        try {
            if (this.scriptPath && fs.existsSync(this.scriptPath)) {
                fs.unlinkSync(this.scriptPath);
            }
        } catch {
            // Ignore cleanup errors
        }
    }
}
