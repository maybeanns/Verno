import * as os from 'os';

export async function speak(text: string, voice?: string, speed?: number): Promise<void> {
  try {
    // Dynamic require to avoid hard dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const say = require('say');
    return new Promise((resolve, reject) => {
      say.speak(text, voice || undefined, speed || 1.0, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  } catch (err) {
    // Fallback: log and no-op
    console.warn('TTS provider not available (say). Message:', text);
    return Promise.resolve();
  }
}
