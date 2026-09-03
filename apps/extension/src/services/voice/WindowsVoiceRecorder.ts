
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class WindowsVoiceRecorder {
    private recordingProcess: cp.ChildProcess | null = null;
    private tempFilePath: string;

    constructor() {
        // Use a unique filename to avoid locking issues
        this.tempFilePath = path.join(os.tmpdir(), `verno_recording_${Date.now()}_${Math.floor(Math.random() * 1000)}.wav`);
    }

    public async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            // PowerShell script to record audio using mciSendString
            // This is a "fire and forget" for starting, we'll stop it later.
            // We use a specific capture command.

            // Note: We use a simplified script that keeps the process alive
            const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Audio {
    [DllImport("winmm.dll", EntryPoint = "mciSendStringA", CharSet = CharSet.Ansi)]
    public static extern int mciSendString(string lpszCommand, string lpszReturnString, int cchReturn, int hwndCallback);
}
"@
$ret = [Audio]::mciSendString("open new type waveaudio alias recsound", $null, 0, 0)
if ($ret -ne 0) { Write-Error "MCI Open Failed: $ret" }
$ret = [Audio]::mciSendString("record recsound", $null, 0, 0)
if ($ret -ne 0) { Write-Error "MCI Record Failed: $ret" }

`;

            try {
                // Spawn PowerShell and keep it open
                this.recordingProcess = cp.spawn('powershell', ['-NoProfile', '-Command', '-'], {
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                if (this.recordingProcess.stdin) {
                    this.recordingProcess.stdin.write(script);
                    // logging
                    console.log('[WindowsVoiceRecorder] Started recording to buffer via PowerShell internal state');
                }

                if (this.recordingProcess.stderr) {
                    this.recordingProcess.stderr.on('data', (data) => {
                        console.error(`[WindowsVoiceRecorder] Stderr: ${data}`);
                    });
                }

                // Give it a moment to actually initialize MCI (500ms)
                setTimeout(() => resolve(), 500);
            } catch (error) {
                reject(error);
            }
        });
    }

    public async stop(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.recordingProcess || !this.recordingProcess.stdin) {
                // If no process, maybe we can still return the file if it exists? 
                // No, that would be unsafe.
                return reject(new Error('No recording process active'));
            }

            // Script to save and close
            // We need to use valid path format for PowerShell
            const validPath = this.tempFilePath.replace(/\\/g, '\\\\');

            const saveScript = `
[Audio]::mciSendString("save recsound ${validPath}", $null, 0, 0)
[Audio]::mciSendString("close recsound", $null, 0, 0)
exit
`;

            try {
                this.recordingProcess.stdin.write(saveScript);
                this.recordingProcess.stdin.end();
            } catch (e) {
                console.error('[WindowsVoiceRecorder] Error writing stop script:', e);
            }

            let resolved = false;

            // Set a timeout to force kill if it doesn't exit gracefully
            const timeout = setTimeout(() => {
                if (resolved) return;
                console.warn('[WindowsVoiceRecorder] Process did not exit in time. Force killing...');
                if (this.recordingProcess) {
                    try {
                        this.recordingProcess.kill('SIGKILL');
                    } catch (e) {
                        try { this.recordingProcess.kill(); } catch (e2) { }
                    }
                }
                // We still try to check if file exists
                if (fs.existsSync(this.tempFilePath)) {
                    const stats = fs.statSync(this.tempFilePath);
                    if (stats.size > 0) {
                        resolve(this.tempFilePath);
                        return;
                    }
                }
                reject(new Error('Recording process timed out and file was not saved.'));
            }, 3000); // 3 seconds timeout

            this.recordingProcess.on('close', (code) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                console.log(`[WindowsVoiceRecorder] Process exited with code ${code}`);

                // Verify file exists and has size
                if (fs.existsSync(this.tempFilePath)) {
                    const stats = fs.statSync(this.tempFilePath);
                    if (stats.size > 0) {
                        resolve(this.tempFilePath);
                    } else {
                        reject(new Error('Recording file created but is empty'));
                    }
                } else {
                    reject(new Error('Recording file not found'));
                }
                this.recordingProcess = null;
            });

            this.recordingProcess.on('error', (err) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                console.error('[WindowsVoiceRecorder] Process error:', err);
                reject(err);
                this.recordingProcess = null;
            });
        });
    }

    public getFilePath(): string {
        return this.tempFilePath;
    }

    public dispose(): void {
        if (this.recordingProcess) {
            try { this.recordingProcess.kill(); } catch (e) { }
        }
        if (fs.existsSync(this.tempFilePath)) {
            try { fs.unlinkSync(this.tempFilePath); } catch (e) { }
        }
    }
}
