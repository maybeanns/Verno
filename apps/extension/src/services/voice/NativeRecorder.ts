import * as fs from 'fs';
import * as path from 'path';
import { VoiceRecorder } from './VoiceRecorder';

interface RecorderInstance {
  stream(): NodeJS.ReadableStream;
  stop(): void;
}

export class NativeRecorder extends VoiceRecorder {
  private recorder: RecorderInstance | null = null;
  private recordingFile: string | null = null;
  private writeStream: fs.WriteStream | null = null;
  private audioChunks: Buffer[] = [];

  constructor() {
    super();
  }

  async startRecording(): Promise<void> {
    try {
      const record = require('node-record-lpcm16');
      this.recordingFile = path.join(
        process.env.TEMP || '/tmp',
        `recording-${Date.now()}.wav`
      );

      this.recorder = record.record({
        sampleRate: 16000,
        channels: 1,
        audioType: 'wav',
      });

      this.writeStream = fs.createWriteStream(this.recordingFile);
      const audioStream = this.recorder!.stream();

      audioStream.on('data', (chunk: Buffer) => {
        this.audioChunks.push(chunk);
        this.writeStream?.write(chunk);
      });

      audioStream.on('error', (error: Error) => {
        console.error('Recording error:', error);
        this.isRecordingFlag = false;
      });

      this.isRecordingFlag = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.isRecordingFlag = false;
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    try {
      this.isRecordingFlag = false;

      if (!this.recorder) {
        return new Blob([], { type: 'audio/wav' });
      }

      this.recorder.stop();

      await new Promise<void>((resolve) => {
        if (this.writeStream) {
          this.writeStream.on('finish', () => {
            resolve();
          });
          this.writeStream.end();
        } else {
          resolve();
        }
      });

      const audioBuffer = Buffer.concat(this.audioChunks);
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });

      this.cleanup();

      return blob;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.cleanup();
      return new Blob([], { type: 'audio/wav' });
    }
  }

  private cleanup(): void {
    this.recorder = null;
    this.writeStream = null;
    this.audioChunks = [];

    if (this.recordingFile && fs.existsSync(this.recordingFile)) {
      fs.unlink(this.recordingFile, (error) => {
        if (error) {
          console.warn('Failed to delete temporary recording file:', error);
        }
      });
    }
    this.recordingFile = null;
  }
}
