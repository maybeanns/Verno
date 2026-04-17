import { LLMService } from '../llm';

export class AmbiguityDetectorService {
  constructor(private llmService: LLMService) {}

  private regexBlocklist = [
    /fast/gi,
    /scalable/gi,
    /user-friendly/gi,
    /robust/gi,
    /soon/gi,
    /many/gi,
    /few/gi,
  ];

  /**
   * Scans a PRD document for vaguely defined terms and heuristics.
   * Modifies the text by inlining warning warnings.
   */
  public async detectAndFlag(prdText: string, useLlm: boolean = false): Promise<string> {
    let flaggedText = prdText;

    // 1. Regex Pass
    for (const regex of this.regexBlocklist) {
      flaggedText = flaggedText.replace(regex, (match) => `${match} ⚠️[Vague Requirement]`);
    }

    // 2. LLM Second Pass (Optional, for deeper context analysis)
    if (useLlm) {
      const prompt = `
You are an expert technical product manager. Review the following PRD text for ambiguous, subjective, or untestable requirements.
Find any non-quantitative adjectives and mark them with "⚠️[Vague]". Do not modify the rest of the text.

PRD:
${flaggedText}
      `;

      try {
        flaggedText = await this.llmService.generateText(prompt);
      } catch (err) {
        // Fallback to regex text if LLM fails
      }
    }

    return flaggedText;
  }
}
