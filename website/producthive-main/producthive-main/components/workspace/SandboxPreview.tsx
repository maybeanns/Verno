'use client';

import { useMemo, useState, useEffect } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import {
    SandpackProvider,
    SandpackPreview,
    SandpackLayout,
    useSandpack,
} from '@codesandbox/sandpack-react';
import type { GeneratedFile } from './CodePanel';

// ── Props ────────────────────────────────────────────────────────────────────

interface SandboxPreviewProps {
    files: GeneratedFile[];
    isGenerating: boolean;
    viewport: 'desktop' | 'tablet' | 'mobile';
    refreshKey: number;
    onSandpackError?: (error: string) => void;
}

const VIEWPORT_WIDTHS: Record<string, string> = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
};

// ── Transform generated files into Sandpack format ──────────────────────────

function buildSandpackFiles(files: GeneratedFile[]): Record<string, string> {
    const sandpackFiles: Record<string, string> = {};

    // Files that Sandpack manages internally via template/customSetup — skip them
    const sandpackManagedPatterns = [
        'package.json', 'tsconfig.json', 'vite.config', 'postcss.config', 'tailwind.config',
    ];

    for (const file of files) {
        // Normalize paths: ensure they start with /
        let path = file.path;
        if (!path.startsWith('/')) path = '/' + path;

        // Skip files that Sandpack manages internally
        const basename = path.split('/').pop() || '';
        if (sandpackManagedPatterns.some(p => basename.includes(p))) continue;

        // Validate JSON files before adding
        if (file.language === 'json') {
            try {
                JSON.parse(file.content);
            } catch {
                // Skip malformed JSON files (AI sometimes generates prose instead)
                continue;
            }
        }

        // Clean content: strip any leading prose/explanation the AI may have added
        let content = file.content;
        if ((file.language === 'tsx' || file.language === 'jsx' || file.language === 'typescript' || file.language === 'javascript') && content.match(/^[A-Z]/)) {
            // Content starts with uppercase letter — likely prose. Try to find code start.
            const codeStart = content.search(/^(import |export |const |function |interface |type |\/\/|\/\*|'use |"use )/m);
            if (codeStart > 0) {
                content = content.slice(codeStart);
            }
        }

        sandpackFiles[path] = content;
    }

    // ── Ensure critical files exist with sensible defaults ──

    // index.html — Vite entry point
    if (!sandpackFiles['/index.html']) {
        sandpackFiles['/index.html'] = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
    }

    // src/main.tsx — React entry
    if (!sandpackFiles['/src/main.tsx']) {
        // Try to find the App file
        const appPath = Object.keys(sandpackFiles).find(p =>
            p.includes('App.tsx') || p.includes('App.jsx')
        );
        const importPath = appPath
            ? appPath.replace(/^\/src\//, './').replace(/\.tsx$|\.jsx$/, '')
            : './App';

        sandpackFiles['/src/main.tsx'] = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "${importPath}";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
    }

    // src/index.css — Tailwind directives
    if (!sandpackFiles['/src/index.css']) {
        sandpackFiles['/src/index.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  min-height: 100vh;
}

html.dark body {
  background: #0a0a0a;
  color: #fafafa;
}`;
    }

    // src/lib/utils.ts — cn helper
    if (!sandpackFiles['/src/lib/utils.ts']) {
        sandpackFiles['/src/lib/utils.ts'] = `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`;
    }

    // tailwind.config.ts
    if (!sandpackFiles['/tailwind.config.ts'] && !sandpackFiles['/tailwind.config.js']) {
        sandpackFiles['/tailwind.config.ts'] = `/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};`;
    }

    // postcss.config.js
    if (!sandpackFiles['/postcss.config.js'] && !sandpackFiles['/postcss.config.cjs']) {
        sandpackFiles['/postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;
    }

    // vite.config.ts
    if (!sandpackFiles['/vite.config.ts']) {
        sandpackFiles['/vite.config.ts'] = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});`;
    }

    // tsconfig.json
    if (!sandpackFiles['/tsconfig.json']) {
        sandpackFiles['/tsconfig.json'] = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}`;
    }

    return sandpackFiles;
}

// ── Extract dependencies from package.json if it exists ─────────────────────

function extractDependencies(files: GeneratedFile[]): Record<string, string> {
    // Base dependencies that Sandpack needs for our stack
    const baseDeps: Record<string, string> = {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.20.0',
        'lucide-react': '^0.468.0',
        'clsx': '^2.1.1',
        'tailwind-merge': '^2.6.0',
        'framer-motion': '^11.0.0',
    };

    // Try to extract from generated package.json
    const pkgFile = files.find(f => f.path.includes('package.json'));
    if (pkgFile) {
        try {
            const pkg = JSON.parse(pkgFile.content);
            const deps = pkg.dependencies || {};
            // Merge — generated deps take priority
            for (const [name, version] of Object.entries(deps)) {
                if (typeof version === 'string') {
                    // Skip Vite-specific packages that Sandpack handles internally
                    if (!['vite', '@vitejs/plugin-react', 'tailwindcss', 'postcss', 'autoprefixer', 'typescript'].includes(name)) {
                        baseDeps[name] = version;
                    }
                }
            }
        } catch {
            // Invalid JSON — use base deps only
        }
    }

    // Scan files for common imports and add their deps
    for (const file of files) {
        if (file.content.includes('@supabase/supabase-js')) {
            baseDeps['@supabase/supabase-js'] = '^2.39.0';
        }
        if (file.content.includes('recharts')) {
            baseDeps['recharts'] = '^2.10.0';
        }
        if (file.content.includes('@radix-ui')) {
            // Extract specific radix packages
            const radixMatches = file.content.matchAll(/@radix-ui\/react-[\w-]+/g);
            for (const match of radixMatches) {
                baseDeps[match[0]] = 'latest';
            }
        }
        if (file.content.includes('date-fns')) {
            baseDeps['date-fns'] = '^3.0.0';
        }
        if (file.content.includes('zustand')) {
            baseDeps['zustand'] = '^4.4.0';
        }
        if (file.content.includes('@tanstack/react-query')) {
            baseDeps['@tanstack/react-query'] = '^5.0.0';
        }
        if (file.content.includes('zod')) {
            baseDeps['zod'] = '^3.22.0';
        }
        if (file.content.includes('react-hook-form')) {
            baseDeps['react-hook-form'] = '^7.48.0';
        }
        if (file.content.includes('@hookform/resolvers')) {
            baseDeps['@hookform/resolvers'] = '^3.3.0';
        }
        if (file.content.includes('axios')) {
            baseDeps['axios'] = '^1.6.0';
        }
        if (file.content.includes('class-variance-authority')) {
            baseDeps['class-variance-authority'] = '^0.7.0';
        }
    }

    return baseDeps;
}

// ── Inner preview component (needs Sandpack context) ────────────────────────

function SandpackInner({
    isGenerating,
    refreshKey,
    onError,
}: {
    isGenerating: boolean;
    refreshKey: number;
    onError?: (errorMsg: string) => void;
}) {
    const { sandpack } = useSandpack();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = (sandpack as any).listen((msg: any) => {
            if (msg.type === 'action' && msg.action === 'show-error') {
                const errorMsg = (msg.title || 'Sandpack Error') + '\n' + (msg.description || '') + '\n' + (msg.stack || '');
                if (onError) onError(errorMsg);
            }
        });
        return () => {
            unsubscribe();
        };
    }, [sandpack, onError]);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => setLoading(false), 2000);
        return () => clearTimeout(timer);
    }, [refreshKey]);

    return (
        <>
            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0e0e10]">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 text-[#DD830A] animate-spin" />
                        <p className="text-[11px] text-white/30">Bundling & rendering...</p>
                    </div>
                </div>
            )}

            {/* Generating overlay */}
            {isGenerating && !loading && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#DD830A] animate-pulse" />
                    <span className="text-[10px] text-white/60">Updating...</span>
                </div>
            )}

            <SandpackPreview
                showOpenInCodeSandbox={false}
                showRefreshButton={false}
                style={{ height: '100%', minHeight: '400px' }}
            />
        </>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SandboxPreview({
    files,
    isGenerating,
    viewport,
    refreshKey,
    onSandpackError,
}: SandboxPreviewProps) {
    const [error, setError] = useState<string | null>(null);

    const sandpackFiles = useMemo(() => {
        if (files.length === 0) return null;
        try {
            setError(null);
            return buildSandpackFiles(files);
        } catch (e: any) {
            setError(e.message);
            return null;
        }
    }, [files]);

    const customDeps = useMemo(() => {
        return extractDependencies(files);
    }, [files]);

    if (files.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#0A0A0E]">
                <div className="text-center space-y-3">
                    <Loader2 className="w-5 h-5 text-[#DD830A]/40 animate-spin mx-auto" />
                    <p className="text-[12px] text-white/25">Waiting for code...</p>
                </div>
            </div>
        );
    }

    if (!sandpackFiles) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#0A0A0E]">
                <div className="text-center space-y-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 mx-auto" />
                    <p className="text-[12px] text-red-400/70">Failed to prepare files for preview</p>
                    {error && <p className="text-[11px] text-white/30 max-w-sm">{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0E] overflow-hidden">
            {/* Error banner */}
            {error && (
                <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    <p className="text-[11px] text-red-400/80 truncate">{error}</p>
                </div>
            )}

            {/* Sandpack container */}
            <div className="flex-1 flex items-start justify-center overflow-auto p-3">
                <motion.div
                    layout
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="relative bg-white rounded-lg overflow-hidden shadow-2xl shadow-black/50"
                    style={{
                        width: VIEWPORT_WIDTHS[viewport],
                        maxWidth: '100%',
                        height: viewport === 'desktop' ? '100%' : '90%',
                        minHeight: '400px',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <SandpackProvider
                        key={`sandpack-${refreshKey}-${files.length}`}
                        template="vite-react-ts"
                        files={sandpackFiles}
                        customSetup={{
                            dependencies: customDeps,
                        }}
                        theme="dark"
                        options={{
                            externalResources: [
                                'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
                            ],
                            classes: {
                                'sp-wrapper': 'sandpack-wrapper-custom',
                                'sp-preview-container': 'sandpack-preview-custom',
                            },
                        }}
                    >
                        <SandpackInner
                            isGenerating={isGenerating}
                            refreshKey={refreshKey}
                            onError={onSandpackError}
                        />
                    </SandpackProvider>
                </motion.div>
            </div>

            {/* Sandpack custom styles */}
            <style jsx global>{`
                .sandpack-wrapper-custom {
                    height: 100% !important;
                    border: none !important;
                    background: transparent !important;
                }
                .sandpack-preview-custom {
                    height: 100% !important;
                }
                .sp-preview-container {
                    height: 100% !important;
                    background: #0a0a0a !important;
                }
                .sp-preview-iframe {
                    height: 100% !important;
                    min-height: 400px !important;
                }
                .sp-layout {
                    border: none !important;
                    background: transparent !important;
                }
                .sp-stack {
                    height: 100% !important;
                }
            `}</style>
        </div>
    );
}
