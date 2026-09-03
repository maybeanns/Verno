/**
 * Browser-based voice recording implementation
 * This file is for webview rendering (browser environment)
 */

import { VoiceRecorder } from './VoiceRecorder';

declare const window: any;
declare const navigator: any;

export class WebviewRecorder extends VoiceRecorder {
  private mediaRecorder: any = null;
  private audioChunks: Blob[] = [];

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new window.MediaRecorder(stream);
      
      this.mediaRecorder.ondataavailable = (event: any) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.start();
      this.isRecordingFlag = true;
    } catch (error) {
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  async stopRecording(): Promise<Blob> {
    if (!this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.audioChunks = [];
        this.isRecordingFlag = false;
        resolve(audioBlob);
      };

      this.mediaRecorder!.stop();
    });
  }
}
