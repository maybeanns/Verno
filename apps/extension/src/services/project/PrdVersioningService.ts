import * as fs from 'fs';
import * as path from 'path';

export class PrdVersioningService {
  /**
   * Archives the currently existing PRD into a versioned file before it gets overwritten.
   */
  public archiveCurrentVersion(workspaceRoot: string, prdFilename: string = 'PRD.md'): void {
    const prdPath = path.join(workspaceRoot, prdFilename);
    const planningDir = path.join(workspaceRoot, '.planning');
    
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }

    if (fs.existsSync(prdPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(planningDir, `${prdFilename.replace('.md', '')}_v${timestamp}.md`);
      
      fs.copyFileSync(prdPath, backupPath);
    }
  }
}
