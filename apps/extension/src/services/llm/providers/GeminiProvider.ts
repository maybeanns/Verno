/**
 * Google Gemini LLM provider implementation
 */

import { ILLMProvider } from '../../../types';

export class GeminiProvider implements ILLMProvider {
  private apiKey: string = '';
  private model: string = 'gemini-2.0-flash';
  private apiEndpoint: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  async initialize(apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Gemini API key cannot be empty');
    }
    // Validate API key format (should start with AIza for Gemini)
    if (!apiKey.startsWith('AIza')) {
      throw new Error('Invalid Gemini API key format. Expected key starting with "AIza"');
    }
    this.apiKey = apiKey.trim();
  }

  async generateText(prompt: string, options?: Record<string, unknown>): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not set');
    }

    try {
      const url = `${this.apiEndpoint}?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: (options?.temperature as number) || 0.7,
            maxOutputTokens: (options?.maxTokens as number) || 2000,
            topP: 0.95,
            topK: 40
          }
        })
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
      }

      const data: any = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      throw error;
    }
  }

  getModelInfo(): Record<string, unknown> {
    return {
      provider: 'Gemini',
      model: this.model,
      endpoint: this.apiEndpoint
    };
  }
  async transcribeAudio(base64Audio: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not set');
    }

    try {
      const url = `${this.apiEndpoint}?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Please transcribe the following audio file exactly as spoken. Do not add any introductory or concluding text, just the transcription."
                },
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: base64Audio
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2, // Low temperature for accuracy
            maxOutputTokens: 2000
          }
        })
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        throw new Error(`Gemini Audio Transcription error: ${errorData.error?.message || response.statusText}`);
      }

      const data: any = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      console.error('[GeminiProvider] Transcribe error:', error);
      throw error;
    }
  }
}
