/**
 * Voice recorder interface
 */

import { IVoiceRecorder } from '../../types';

export abstract class VoiceRecorder implements IVoiceRecorder {
  protected isRecordingFlag: boolean = false;

  abstract startRecording(): Promise<void>;
  abstract stopRecording(): Promise<Blob>;

  isRecording(): boolean {
    return this.isRecordingFlag;
  }
}
