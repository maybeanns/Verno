export class MockLLMService {
  /**
   * Pre-configured responses corresponding to different prompts/stages.
   */
  private mockResponses: Record<string, string> = {};
  
  public setMockResponse(keyContains: string, response: string) {
    this.mockResponses[keyContains] = response;
  }

  public async generateText(prompt: string): Promise<string> {
    for (const [key, response] of Object.entries(this.mockResponses)) {
      if (prompt.includes(key)) {
        return Promise.resolve(response);
      }
    }
    
    // Default fallback
    return Promise.resolve('[MOCK LLM RESPONSE] Success.');
  }

  public async streamGenerate(prompt: string, options: any, callback: (token: string) => void): Promise<string> {
    const fullResponse = await this.generateText(prompt);
    
    // Simulate streaming
    const chunks = fullResponse.match(/.{1,10}/g) || [fullResponse];
    for (const chunk of chunks) {
      callback(chunk);
    }
    return fullResponse;
  }
}
