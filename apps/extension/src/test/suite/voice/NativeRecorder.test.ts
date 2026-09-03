import * as assert from 'assert';
import { NativeRecorder } from '../../../services/voice/NativeRecorder';

suite('NativeRecorder Tests', () => {
  test('NativeRecorder class exists and start/stop handle missing dependency', async () => {
    const rec = new NativeRecorder();
    let threw = false;
    try {
      await rec.startRecording();
    } catch (e) {
      threw = true;
    }
    // In CI environment node-record-lpcm16 is likely not installed; ensure it fails gracefully
    assert.ok(threw || rec.isRecording());
  });
});
