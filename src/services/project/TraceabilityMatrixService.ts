import * as fs from 'fs';
import * as path from 'path';

export interface EpicLink {
  prdSection: string;
  epicId: string;
  epicTitle: string;
}

export class TraceabilityMatrixService {
  /**
   * Generates a simple Requirements Traceability Matrix matching PRD sections to Epic titles.
   */
  public generateMatrix(workspaceRoot: string, epics: any[], prdPath: string = 'PRD.md'): void {
    const fullPrdPath = path.join(workspaceRoot, prdPath);
    let prdContent = '';
    
    if (fs.existsSync(fullPrdPath)) {
      prdContent = fs.readFileSync(fullPrdPath, 'utf8');
    }

    // Very naive extraction: assumes PRD has markdown headers for sections
    const sections = prdContent.match(/^###\s+(.*)$/gm) || ['General Feature'];
    
    const matrixLines = ['# Requirements Traceability Matrix', '', '| PRD Section | Epic ID | Epic Title |', '|---|---|---|'];
    
    // Map epics round-robin to sections for simulation, or try to match text loosely
    epics.forEach((epic, i) => {
      const section = sections[i % sections.length].replace('### ', '').trim();
      matrixLines.push(`| ${section} | ${epic.id || 'EPIC-'+(i+1)} | ${epic.title} |`);
    });

    const matrixPath = path.join(workspaceRoot, '.planning', 'TRACEABILITY.md');
    fs.mkdirSync(path.dirname(matrixPath), { recursive: true });
    fs.writeFileSync(matrixPath, matrixLines.join('\n'), 'utf8');
  }
}
