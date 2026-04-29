'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { GeneratedFile } from './CodePanel';

// ── Props ────────────────────────────────────────────────────────────────────

interface SandboxPreviewProps {
    files: GeneratedFile[];
    isGenerating: boolean;
    viewport: 'desktop' | 'tablet' | 'mobile';
    refreshKey: number;
}

const VIEWPORT_WIDTHS = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
};

// ── Build the preview HTML ───────────────────────────────────────────────────

function buildPreviewHTML(files: GeneratedFile[]): string {
    const appFile = files.find(f =>
        f.path.includes('App.tsx') || f.path.includes('App.jsx') ||
        f.path.includes('App.ts') || f.path.includes('App.js')
    );

    // Collect component files (skip configs, entry points)
    const skipPatterns = ['vite.config', 'tailwind.config', 'postcss', 'tsconfig',
        'package.json', 'main.tsx', 'main.ts', 'main.jsx', 'main.js',
        'index.html', 'env.d.ts', '.css'];

    const componentFiles = files.filter(f => {
        if (f.path === appFile?.path) return false;
        if (f.language !== 'tsx' && f.language !== 'jsx' && f.language !== 'typescript' && f.language !== 'javascript') return false;
        return !skipPatterns.some(p => f.path.includes(p));
    });

    // Build inlined component code
    const componentCode = componentFiles.map(f => {
        const code = cleanCode(f.content);
        return `// ── ${f.path}\n${code}`;
    }).join('\n\n');

    // Build App code
    let appCode = appFile ? cleanCode(appFile.content) : 'function App() { return React.createElement("div", {className:"p-8 text-center"}, React.createElement("h1", {className:"text-2xl font-bold"}, "App")); }';

    // Find the App function/const name
    let appName = 'App';
    const fnMatch = appCode.match(/function\s+(\w+)\s*\(/);
    const constMatch = appCode.match(/const\s+(\w+)\s*[=:]/);
    if (fnMatch) appName = fnMatch[1];
    else if (constMatch) appName = constMatch[1];

    // Collect any CSS
    const cssContent = files.filter(f => f.language === 'css').map(f => f.content).join('\n');

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Preview</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<script>
tailwind.config = {
  darkMode: 'class',
  theme: { extend: { fontFamily: { sans: ['Inter','system-ui','sans-serif'] } } }
};
<\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;background:#ffffff;min-height:100vh}
html.dark body{background:#0a0a0a;color:#fafafa}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
${cssContent}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react,typescript">
const {useState,useEffect,useRef,useCallback,useMemo,createContext,useContext,useReducer,forwardRef,Fragment}=React;
const cn=(...a)=>a.filter(Boolean).join(' ');

// ── Router stubs ──
const Link=({children,to,href,className,...p})=>React.createElement('a',{href:to||href||'#',className,...p},children);
const BrowserRouter=({children})=>React.createElement(React.Fragment,null,children);
const Routes=({children})=>{const c=React.Children.toArray(children);return c[0]||null};
const Route=({element,children})=>element||children||null;
const useNavigate=()=>()=>{};
const useParams=()=>({});
const useLocation=()=>({pathname:'/',search:'',hash:''});
const Outlet=()=>null;
const Navigate=()=>null;

// ── Icon stubs (Lucide) ──
const LucideIcon=({name,className,...p})=>React.createElement('span',{className:'inline-flex items-center justify-center '+className,...p},'');
const iconNames=['ArrowRight','ArrowLeft','Check','ChevronDown','ChevronRight','ChevronUp','Clock','Copy','Download','Edit','ExternalLink','Eye','Filter','Globe','Heart','Home','Image','Info','Link','Loader2','Lock','LogOut','Mail','MapPin','Menu','MessageCircle','Moon','MoreHorizontal','MoreVertical','Phone','Plus','Search','Send','Settings','Share','ShoppingCart','Star','Sun','Trash','Upload','User','Users','X','Zap','Calendar','Bell','Bookmark','Camera','Cloud','Code','Coffee','Compass','Database','File','FileText','Flag','Folder','Gift','Grid','Hash','Headphones','Key','Layers','Layout','LifeBuoy','List','Map','Monitor','Music','Package','PenTool','Percent','PieChart','Play','Pocket','Power','Printer','Radio','RefreshCw','RotateCw','Scissors','Server','Shield','Shuffle','Sidebar','Sliders','Smartphone','Speaker','Tag','Target','Terminal','ThumbsUp','Tool','TrendingUp','Truck','Tv','Type','Umbrella','Video','Wifi','Wind','Activity','Award','Box','Briefcase','Building','Building2','Cpu','CreditCard','Disc','DollarSign','Github','Gitlab','HardDrive','Hexagon','Inbox','Instagram','Laptop','Linkedin','Maximize','Mic','Minimize','Navigation','Paperclip','Pause','Save','ShoppingBag','Slash','Square','StopCircle','Sunrise','Table','Tablet','ToggleLeft','ToggleRight','Underline','Unlock','VolumeX','Watch','Youtube','Rocket','Sparkles','Bot','Brain','Flame','Crown','Trophy','Gem','Wand2','Palette','Paintbrush','CircleCheck','CircleX','AlertCircle','AlertTriangle','BadgeCheck','Gauge','Workflow','Blocks','Component','SquareStack','PanelLeft','PanelRight','GripVertical','MoveHorizontal','Asterisk','Lightbulb'];
iconNames.forEach(n=>{if(typeof window!=='undefined')window[n]=({className='',size=16,...p})=>React.createElement('svg',{className:'inline-block '+className,width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',...p},React.createElement('circle',{cx:12,cy:12,r:1}))});

// ── shadcn/ui stubs ──
const Button=({children,className='',variant='default',size='default',onClick,disabled,asChild,...p})=>{
  const base='inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';
  const v={default:'bg-blue-600 text-white hover:bg-blue-700 shadow',destructive:'bg-red-600 text-white hover:bg-red-700',outline:'border border-gray-300 dark:border-gray-700 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800',secondary:'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-700',ghost:'hover:bg-gray-100 dark:hover:bg-gray-800',link:'text-blue-600 underline-offset-4 hover:underline'};
  const s={default:'h-10 px-4 py-2',sm:'h-9 rounded-md px-3 text-xs',lg:'h-11 rounded-md px-8 text-base',icon:'h-10 w-10'};
  return React.createElement('button',{className:cn(base,v[variant]||v.default,s[size]||s.default,className),onClick,disabled,...p},children);
};
const Card=({children,className='',...p})=>React.createElement('div',{className:cn('rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm',className),...p},children);
const CardHeader=({children,className='',...p})=>React.createElement('div',{className:cn('flex flex-col space-y-1.5 p-6',className),...p},children);
const CardTitle=({children,className='',...p})=>React.createElement('h3',{className:cn('text-2xl font-semibold leading-none tracking-tight',className),...p},children);
const CardDescription=({children,className='',...p})=>React.createElement('p',{className:cn('text-sm text-gray-500 dark:text-gray-400',className),...p},children);
const CardContent=({children,className='',...p})=>React.createElement('div',{className:cn('p-6 pt-0',className),...p},children);
const CardFooter=({children,className='',...p})=>React.createElement('div',{className:cn('flex items-center p-6 pt-0',className),...p},children);
const Input=({className='',...p})=>React.createElement('input',{className:cn('flex h-10 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50',className),...p});
const Label=({children,className='',...p})=>React.createElement('label',{className:cn('text-sm font-medium leading-none',className),...p},children);
const Badge=({children,className='',variant='default',...p})=>{
  const v={default:'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',secondary:'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',destructive:'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',outline:'border border-gray-300 dark:border-gray-700'};
  return React.createElement('div',{className:cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',v[variant]||v.default,className),...p},children);
};
const Separator=({className='',...p})=>React.createElement('div',{className:cn('shrink-0 bg-gray-200 dark:bg-gray-800 h-[1px] w-full',className),...p});
const Avatar=({children,className='',...p})=>React.createElement('div',{className:cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',className),...p},children);
const AvatarFallback=({children,className='',...p})=>React.createElement('div',{className:cn('flex h-full w-full items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600 text-sm font-medium',className),...p},children);
const AvatarImage=({src,alt='',className='',...p})=>React.createElement('img',{src,alt,className:cn('aspect-square h-full w-full object-cover',className),...p});
const Textarea=({className='',...p})=>React.createElement('textarea',{className:cn('flex min-h-[80px] w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50',className),...p});
const Switch=({checked,onCheckedChange,className=''})=>React.createElement('button',{role:'switch','aria-checked':checked,onClick:()=>onCheckedChange&&onCheckedChange(!checked),className:cn('inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',checked?'bg-blue-600':'bg-gray-200 dark:bg-gray-700',className)},React.createElement('span',{className:cn('block h-5 w-5 rounded-full bg-white shadow-lg transition-transform',checked?'translate-x-5':'translate-x-0')}));
const Skeleton=({className='',...p})=>React.createElement('div',{className:cn('animate-pulse rounded-md bg-gray-200 dark:bg-gray-800',className),...p});
const Progress=({value=0,className='',...p})=>React.createElement('div',{className:cn('relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800',className),...p},React.createElement('div',{className:'h-full bg-blue-600 transition-all',style:{width:value+'%'}}));
const ScrollArea=({children,className='',...p})=>React.createElement('div',{className:cn('overflow-auto',className),...p},children);
const Sheet=({children})=>React.createElement(React.Fragment,null,children);
const SheetTrigger=({children,asChild})=>children;
const SheetContent=({children,className=''})=>React.createElement('div',{className:cn('fixed inset-y-0 right-0 z-50 w-80 bg-white dark:bg-gray-950 border-l p-6',className)},children);
const Dialog=({children})=>React.createElement(React.Fragment,null,children);
const DialogTrigger=({children,asChild})=>children;
const DialogContent=({children,className=''})=>null;
const DialogHeader=({children,className=''})=>React.createElement('div',{className},children);
const DialogTitle=({children,className=''})=>React.createElement('h2',{className:cn('text-lg font-semibold',className)},children);
const DialogDescription=({children,className=''})=>React.createElement('p',{className:cn('text-sm text-gray-500',className)},children);
const Select=({children,value,onValueChange})=>React.createElement(React.Fragment,null,children);
const SelectTrigger=({children,className=''})=>React.createElement('button',{className:cn('flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',className)},children);
const SelectContent=({children})=>null;
const SelectItem=({children,value})=>React.createElement('option',{value},children);
const SelectValue=({placeholder})=>React.createElement('span',{className:'text-gray-400'},placeholder);
const Accordion=({children,className='',...p})=>React.createElement('div',{className,...p},children);
const AccordionItem=({children,value,className=''})=>React.createElement('div',{className:cn('border-b',className)},children);
const AccordionTrigger=({children,className=''})=>React.createElement('button',{className:cn('flex w-full items-center justify-between py-4 text-sm font-medium',className)},children);
const AccordionContent=({children,className=''})=>React.createElement('div',{className:cn('pb-4 text-sm',className)},children);
const Tooltip=({children})=>React.createElement(React.Fragment,null,children);
const TooltipTrigger=({children,asChild})=>children;
const TooltipContent=({children})=>null;
const TooltipProvider=({children})=>React.createElement(React.Fragment,null,children);
const DropdownMenu=({children})=>React.createElement(React.Fragment,null,children);
const DropdownMenuTrigger=({children,asChild})=>children;
const DropdownMenuContent=({children})=>null;
const DropdownMenuItem=({children})=>React.createElement('div',null,children);
const NavigationMenu=({children,className=''})=>React.createElement('nav',{className},children);
const NavigationMenuList=({children,className=''})=>React.createElement('ul',{className:cn('flex gap-1',className)},children);
const NavigationMenuItem=({children})=>React.createElement('li',null,children);
const NavigationMenuLink=({children,className='',...p})=>React.createElement('a',{className,...p},children);

// ── Supabase stub ──
const createClient=()=>({from:()=>({select:()=>Promise.resolve({data:[],error:null}),insert:()=>Promise.resolve({data:null,error:null}),update:()=>Promise.resolve({data:null,error:null}),delete:()=>Promise.resolve({data:null,error:null})}),auth:{getUser:()=>Promise.resolve({data:{user:null},error:null}),signIn:()=>Promise.resolve({data:null,error:null}),signUp:()=>Promise.resolve({data:null,error:null}),signOut:()=>Promise.resolve({error:null})}});

// ── Component code ──
${componentCode}

// ── App ──
${appCode}

// ── Mount ──
try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(${appName}));
} catch(e) {
  document.getElementById('root').innerHTML = '<div style="padding:40px;color:#ef4444;font-family:monospace;font-size:13px"><p style="font-weight:bold;margin-bottom:8px">Render Error</p><pre style="white-space:pre-wrap;color:#fca5a5">'+e.message+'</pre></div>';
}
<\/script>
</body>
</html>`;
}

// ── Clean code for inlining ─────────────────────────────────────────────────

function cleanCode(code: string): string {
    return code
        // Remove all import statements
        .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
        .replace(/^import\s+['"].*?['"];?\s*$/gm, '')
        .replace(/^import\s+type\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
        // Remove export { ... } lines
        .replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
        // Remove 'export default' but keep the function/const
        .replace(/^export\s+default\s+/gm, '')
        // Remove 'export ' from named exports
        .replace(/^export\s+(const|function|class|interface|type|enum)/gm, '$1')
        // Remove TypeScript type annotations that cause issues
        .replace(/:\s*React\.FC(<[^>]*>)?/g, '')
        .replace(/:\s*JSX\.Element/g, '')
        // Remove 'as const' assertions
        .replace(/\s+as\s+const/g, '')
        .trim();
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SandboxPreview({ files, isGenerating, viewport, refreshKey }: SandboxPreviewProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const previewHTML = useMemo(() => {
        if (files.length === 0) return '';
        try {
            setError(null);
            return buildPreviewHTML(files);
        } catch (e: any) {
            setError(e.message);
            return '';
        }
    }, [files, refreshKey]);

    useEffect(() => { setLoading(true); }, [previewHTML]);

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

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0E] overflow-hidden">
            {/* Error banner */}
            {error && (
                <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    <p className="text-[11px] text-red-400/80 truncate">{error}</p>
                </div>
            )}

            {/* Iframe container */}
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
                    {/* Loading overlay */}
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0e0e10]">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-5 h-5 text-[#DD830A] animate-spin" />
                                <p className="text-[11px] text-white/30">Rendering preview...</p>
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

                    {previewHTML && (
                        <iframe
                            key={`preview-${refreshKey}`}
                            srcDoc={previewHTML}
                            onLoad={() => setLoading(false)}
                            sandbox="allow-scripts allow-modals allow-popups"
                            title="App Preview"
                            className="w-full h-full border-0"
                            style={{ minHeight: '400px', background: '#0a0a0a' }}
                        />
                    )}
                </motion.div>
            </div>
        </div>
    );
}
