import * as fs from 'fs';
import * as path from 'path';

export class DependencyGraphService {
  /**
   * Generates a Mermaid JS graph from the topological sort of Epics/Stories.
   */
  public generateMermaidGraph(workspaceRoot: string, stories: any[]): void {
    const lines = ['```mermaid', 'graph TD'];
    
    stories.forEach(story => {
      const safeId = story.id.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`  ${safeId}["${story.title}"]`);
      
      const deps = story.dependsOn as string[] || [];
      deps.forEach(depId => {
        const safeDep = depId.replace(/[^a-zA-Z0-9]/g, '_');
        lines.push(`  ${safeDep} --> ${safeId}`);
      });
    });

    lines.push('```');

    const filePath = path.join(workspaceRoot, '.planning', 'DEPENDENCY_GRAPH.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  }
}
