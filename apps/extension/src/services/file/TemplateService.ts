/**
 * File template service for code generation
 */

export class TemplateService {
  private templates: Map<string, string> = new Map();

  registerTemplate(name: string, template: string): void {
    this.templates.set(name, template);
  }

  getTemplate(name: string): string | undefined {
    return this.templates.get(name);
  }

  renderTemplate(name: string, variables: Record<string, string>): string {
    const template = this.getTemplate(name);
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }

    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(`{{${key}}}`, value);
    }

    return rendered;
  }
}
