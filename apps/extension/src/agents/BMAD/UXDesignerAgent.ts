import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { FileService } from '../../services/file/FileService';
import { FileChangeTracker } from '../../services/file/FileChangeTracker';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UserBranding {
  /** User-supplied colors. Each value is any valid CSS color string. */
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
    [key: string]: string | undefined;
  };
  /** User-supplied font families (display and body). */
  fonts?: {
    display?: string;
    body?: string;
    mono?: string;
  };
  /** Freeform personality words, e.g. ["warm", "bold", "clinical"] */
  personality?: string[];
  /** Whether the user explicitly requested dark or light mode. */
  colorScheme?: 'light' | 'dark' | 'system';
  /** Raw branding notes / brand guide excerpts from the user. */
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-pattern catalogue (Impeccable)
// ─────────────────────────────────────────────────────────────────────────────

const IMPECCABLE_ANTIPATTERNS = `
## ⛔ ABSOLUTE BANS — AI SLOP FINGERPRINTS
These are the most recognizable tells of AI-generated UI. If you find yourself
producing any of these, STOP and redesign the element entirely.

### CSS Pattern Bans
1. **Side-stripe borders** — NEVER use border-left or border-right > 1px as a
   colored accent stripe on cards, alerts, list items, or callouts.
   - Forbidden: \`border-left: 3px solid var(--color-primary)\`
   - Rewrite: use full borders, background tints, leading icons, or no indicator.

2. **Gradient text** — NEVER use \`background-clip: text\` + a gradient background.
   Text fill must always be a single solid color.
   - Forbidden: any \`linear-gradient\` or \`radial-gradient\` used as a text color.
   - Rewrite: use font-weight, size, or solid color for emphasis.

3. **AI color palette** — NEVER default to:
   - Cyan-on-dark (\`#00D4FF\`, \`#06B6D4\`, etc.)
   - Purple-to-blue gradients (\`#7C3AED → #2563EB\`, etc.)
   - Neon glows on dark backgrounds
   - These are the three most recognizable AI palette tells.

4. **Dark glow cards** — NEVER use \`box-shadow: 0 0 20px oklch(...)\` on dark
   backgrounds as a "premium" effect. It reads immediately as AI output.

### Layout Bans
5. **Everything centered** — NOT every section, card, heading, and paragraph.
   Left-aligned text with asymmetric layouts feels genuinely designed.

6. **Monotonous spacing** — NOT the same padding value repeated everywhere.
   Varied spacing is what creates visual hierarchy and rhythm.

7. **Identical card grids** — NOT rows of identical cards with icon-tile +
   heading + body text. This is the universal AI template.

8. **Nested cards** — NEVER put cards inside cards. Flatten the hierarchy.

9. **Icon tile above every heading** — NEVER stack a small rounded-square icon
   container above every section heading. It signals templating.

10. **Hero metric template** — NEVER use: big number → small label →
    supporting stats → gradient accent. This specific combination is a brand
    mark of AI dashboards.

### Typography Bans
11. **Overused fonts** — NEVER use any font from this reflex-rejection list:
    Inter, Roboto, Open Sans, Arial, system-ui, DM Sans, Plus Jakarta Sans,
    Outfit, Space Grotesk, Space Mono, IBM Plex Sans, IBM Plex Mono,
    Fraunces, Newsreader, Lora, Crimson Pro, Playfair Display, Cormorant,
    Syne, Instrument Sans, Instrument Serif, DM Serif Display.
    (Exception: if the USER explicitly supplies one of these as their brand font,
    honor it — but do not CHOOSE it yourself.)

12. **Flat type hierarchy** — NOT sizes that are too close together. Minimum
    1.25× ratio between type scale steps.

### Motion Bans
13. **Bounce / elastic easing** — NEVER use \`cubic-bezier\` values that overshoot
    and spring back. They feel dated. Objects decelerate smoothly.

14. **Animating layout properties** — NEVER animate width, height, padding, or
    margin directly. Only transform and opacity for GPU-composited performance.

### Decoration Bans
15. **Glassmorphism as default** — NOT blur + semi-transparent cards everywhere.
    Only use glassmorphism when it serves a specific layering purpose.

16. **Sparkline decoration** — NOT tiny charts that look sophisticated but
    convey no actual data insight.

17. **Modals as default** — NEVER reach for a modal first. Consider drawers,
    inline expansion, or contextual panels instead.
`;

// ─────────────────────────────────────────────────────────────────────────────
// Impeccable font selection procedure (verbatim from skill)
// ─────────────────────────────────────────────────────────────────────────────

const FONT_SELECTION_PROCEDURE = `
## Font Selection Procedure (DO THIS BEFORE NAMING ANY FONT)

Step 1. Write 3 concrete brand-voice words from the brief.
        NOT "modern" or "elegant" — dead categories. Think physical objects.

Step 2. List the 3 fonts your training reflex wants to reach for.
        If any appear in the REFLEX REJECTION LIST above (rule 11), discard them.

Step 3. Browse Google Fonts / Klim / ABC Dinamo / Future Fonts with those 3 words.
        Ask: what physical object has this typography?
        (a museum label, a 1970s manual, a hand-painted sign, a fabric tag, a 
        children's book on cheap newsprint)
        Reject the FIRST thing that "looks designy" — that IS the trained reflex.

Step 4. Cross-check: technical brief ≠ monospace font. Warm brief ≠ Fraunces.
        If your pick matches your reflex pattern, go back to Step 3.
`;

// ─────────────────────────────────────────────────────────────────────────────
// Product profiles
// ─────────────────────────────────────────────────────────────────────────────

interface ProductProfile {
  keywords: string[];
  aesthetic: string;
  layoutHint: string;
  animationHint: string;
  themeHint: string;
}

const PRODUCT_PROFILES: Record<string, ProductProfile> = {
  mobile: {
    keywords: ['mobile', 'ios', 'android', 'app', 'flutter', 'react native', 'native'],
    aesthetic:
      'Tactile Material — rounded surfaces, thumb-zone-first layout, bottom navigation, ' +
      'iOS safe-area awareness, physical depth through cast shadows not glows',
    layoutHint:
      '375px base, single-column, bottom nav 56px, sheet modals, swipe gestures, ' +
      'min tap target 48×48px, content inset 16px horizontal',
    animationHint:
      'Spring transitions (cubic-bezier(0.34,1.56,0.64,1)), 150ms feedback, ' +
      '300ms navigation, shared-element transitions between screens',
    themeHint:
      'Choose based on context: meditation/sleep apps → dark, health/productivity → light, ' +
      'social → system preference with explicit toggle',
  },
  dashboard: {
    keywords: ['dashboard', 'admin', 'analytics', 'metrics', 'kpi', 'monitor', 'panel', 'crm', 'erp', 'bi'],
    aesthetic:
      'Data-Dense Utilitarian — deep neutrals, electric single accent, ' +
      'monospaced numbers, visible grid lines, information before decoration',
    layoutHint:
      '240px collapsible sidebar, 12-col content grid, sticky 48px header, ' +
      'scrollable tables, resizable split panes, notification toasts bottom-right',
    animationHint:
      'Chart entry 500ms ease-out stagger, number count-up, skeleton shimmer, ' +
      'panel collapse 200ms ease-in-out, NO page transitions (kills perceived speed)',
    themeHint:
      'Dark for SRE/ops/trading (dark office, screen-glare context). ' +
      'Light for business intelligence viewed in meetings. Never default; derive from context.',
  },
  landing: {
    keywords: ['landing', 'marketing', 'saas', 'homepage', 'website', 'product page', 'waitlist', 'launch'],
    aesthetic:
      'Type-Led Editorial — oversized display headlines carry the weight, ' +
      'restrained accent color, generous whitespace, photography or illustrations as counterpoint',
    layoutHint:
      'Full-width sections, centered hero max-width 1200px, alternating feature rows, ' +
      'sticky CTA ribbon on scroll, footer with full link grid',
    animationHint:
      'Scroll-triggered section reveals (Intersection Observer, 60ms per-element stagger), ' +
      'hero word-by-word type animation, parallax on hero image (subtle: max 20px shift)',
    themeHint:
      'Light for B2C, consumer, food, lifestyle. Dark for dev tools, security, infra. ' +
      'The theme IS a positioning statement — choose deliberately.',
  },
  ecommerce: {
    keywords: ['shop', 'store', 'ecommerce', 'product', 'cart', 'checkout', 'marketplace', 'retail'],
    aesthetic:
      'Product-First Minimal — photography leads, typography recedes, ' +
      'generous whitespace, brand color reserved for CTAs and accents only',
    layoutHint:
      'Auto-fit product grid (minmax 260px, 1fr)), sticky mini-cart drawer, ' +
      'breadcrumb trail, filter sidebar collapsible, checkout single-column focused',
    animationHint:
      'Image zoom hover (scale 1.04, 400ms ease), cart drawer slide-in (350ms), ' +
      'add-to-cart confirmation burst, quantity input press feedback',
    themeHint: 'Light as default. Dark variant for premium/luxury brands only.',
  },
  saas_tool: {
    keywords: ['tool', 'editor', 'ide', 'builder', 'platform', 'workspace', 'productivity', 'workflow', 'code'],
    aesthetic:
      'Focused Command-Line Aesthetic — neutral gray scale, ' +
      'keyboard-first interaction cues visible in the UI, high information density without clutter',
    layoutHint:
      'Three-pane (file tree 220px / editor / output), resizable panels, ' +
      'command palette overlay, tab bar, status bar 24px, notification toasts bottom-right',
    animationHint:
      'Panel resize 100ms linear, command palette fuzzy highlight, ' +
      'toast slide-up 200ms, tab switch instant (no animation), save pulse on icon',
    themeHint: 'Dark by default (developers work in dark rooms). Offer light as explicit option.',
  },
};

const DEFAULT_PROFILE: ProductProfile = {
  keywords: [],
  aesthetic: 'Refined Purposeful — warm neutrals, single bold accent, clear type hierarchy',
  layoutHint: 'Responsive centered, max-width 1200px, 12-col grid, sticky navigation',
  animationHint: 'Fade + translateY(8px) entry 250ms ease-out, 200ms hover transitions',
  themeHint: 'Derive theme from the audience context. Do not default without reasoning.',
};

// ─────────────────────────────────────────────────────────────────────────────
// UXDesignerAgent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UX Designer Agent (Sally)
 *
 * Features:
 * - Product-type detection (mobile / dashboard / landing / ecommerce / saas tool)
 * - User-supplied branding / palette support
 * - Post-development rebrand support (generates REBRAND.md diff instructions)
 * - Impeccable anti-pattern system fully embedded
 * - Live streaming to UX_DESIGN.md so developer agent can read in parallel
 */
export class UXDesignerAgent extends BaseAgent {
  name = 'uxdesigner';
  description = 'UX Designer (Sally) — User research, interaction design, UI/UX prototyping';

  constructor(
    protected logger: any,
    private llmService: LLMService,
    private fileService: FileService,
    private changeTracker: FileChangeTracker
  ) {
    super(logger);
  }

  // ── Product type detection ──────────────────────────────────────────────────

  private detectProductType(request: string): string {
    const lower = request.toLowerCase();
    for (const [type, profile] of Object.entries(PRODUCT_PROFILES)) {
      if (profile.keywords.some((kw) => lower.includes(kw))) return type;
    }
    return 'default';
  }

  // ── Branding context block ──────────────────────────────────────────────────

  private buildBrandingContext(branding?: UserBranding): string {
    if (!branding) return '';

    const lines: string[] = ['## USER-PROVIDED BRANDING — HONOR THESE EXACTLY'];

    if (branding.colors && Object.keys(branding.colors).length > 0) {
      lines.push(
        '',
        '### Color Palette (user-supplied — do NOT replace with your own choices)',
        'Map each value to the appropriate design token. Convert hex/rgb to oklch() but',
        'keep the hue and lightness intent intact. Do not substitute different colors.',
        '',
        '```',
        ...Object.entries(branding.colors)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`),
        '```',
        '',
        '> When generating CSS tokens, derive light/dark surface variants from these',
        '> base colors using oklch lightness shifts. Do not invent new hues.',
      );
    }

    if (branding.fonts) {
      lines.push(
        '',
        '### Fonts (user-supplied — honor these; skip the font selection procedure)',
        ...Object.entries(branding.fonts)
          .filter(([, v]) => v)
          .map(([k, v]) => `- ${k}: ${v}`),
      );
    }

    if (branding.colorScheme) {
      lines.push('', `### Color Scheme: **${branding.colorScheme}** (user-specified — do not override)`);
    }

    if (branding.personality?.length) {
      lines.push('', `### Brand Personality Words: ${branding.personality.join(', ')}`);
    }

    if (branding.notes) {
      lines.push('', '### Brand Notes', branding.notes);
    }

    return lines.join('\n');
  }

  // ── Main prompt ─────────────────────────────────────────────────────────────

  private buildPrompt(
    context: IAgentContext,
    productType: string,
    isRebrand: boolean,
    branding?: UserBranding,
  ): string {
    const prev = (context.metadata?.previousOutputs || {}) as Record<string, string>;
    const analysis = (prev['analyst'] || '').substring(0, 1500);
    const architecture = (prev['architect'] || '').substring(0, 800);
    const prdContent = (prev['pm'] || '').substring(0, 1500);
    const existingSpec = (prev['uxdesigner'] || '').substring(0, 3000);
    const userRequest = (context.metadata?.userRequest as string) || 'design user experience';

    const profile = PRODUCT_PROFILES[productType] ?? DEFAULT_PROFILE;
    const brandingContext = this.buildBrandingContext(branding);

    // ── Rebrand mode: generate a diff/patch document, not a full spec ──────────
    if (isRebrand) {
      return `You are Sally, Principal UX Designer. The product has already been built.
The user wants to change the color palette and/or branding. Your job is NOT to
redesign the product — it is to produce a precise, surgical REBRAND PATCH that
tells the developer agent EXACTLY what to change and what to leave alone.

## USER REQUEST
${userRequest}

${brandingContext}

## EXISTING UX SPEC (what was built)
${existingSpec}

---

## OUTPUT: REBRAND.md

Produce a file with these sections:

### 1. TOKEN REPLACEMENTS
For every design token that must change, show:
| Old Token Value | New Token Value | Token Name |
Show the FULL oklch() value for both old and new.
Include ALL derived tokens (hover states, disabled opacity variants, tints).

### 2. OKLCH CONVERSION TABLE
If the user supplied hex/rgb colors, convert every one to oklch() here.
Show: Input value → oklch(L C H) → Reasoning (what the perceptual shift preserves).

### 3. DARK/LIGHT SURFACE DERIVATION
Show how to derive surface, background, border, and muted variants from the
new primary/accent colors using lightness shifts only (no hue changes).
Format:
\`\`\`css
/* Derived from --color-primary: oklch(55% 0.22 260) */
--color-surface:     oklch(97% 0.01 260); /* L+42, C×0.05 */
--color-border:      oklck(85% 0.03 260); /* L+30, C×0.14 */
\`\`\`

### 4. TYPOGRAPHY CHANGES (if any)
If fonts changed: exact @import URLs + before/after CSS variable values.
If no font changes: write "No typography changes."

### 5. COMPONENT AUDIT
List every component where the color appears as a hard-coded value (not via token).
For each, show the exact CSS selector and what to change.

### 6. WHAT NOT TO CHANGE
Explicitly list layout, spacing, animation, and typographic decisions that must
stay unchanged. Prevents the developer from over-applying the rebrand.

### 7. ANTI-PATTERN ALERT (if applicable)
If the user's supplied palette triggers any Impeccable anti-patterns
(e.g., they gave you a purple-to-blue gradient, or cyan-on-dark), note it here
with a clear explanation and offer an alternative that preserves their intent
without the AI-slop signature.

Be surgical. The rebrand should feel like a brand refresh, not a redesign.
Every change in this document must have a one-to-one CSS mapping.`;
    }

    // ── Full spec mode ─────────────────────────────────────────────────────────
    return `You are Sally, a Principal UX Designer and Design Systems Engineer with 15+ years
at Apple, Stripe, and Linear. You ship interfaces that look like a human designer
who cares deeply made every decision.

## MISSION
Produce a COMPLETE, DEVELOPER-READY UX Design Specification. The developer agent
reads this file LIVE as you write it — every color, size, animation, and rule must
be explicit. Nothing left to interpretation.

## PRODUCT REQUEST
${userRequest}

## PRODUCT TYPE: ${productType.toUpperCase()}
- Aesthetic: ${profile.aesthetic}
- Layout: ${profile.layoutHint}
- Animation: ${profile.animationHint}
- Theme reasoning: ${profile.themeHint}

${brandingContext}

${analysis ? `## ANALYST REQUIREMENTS\n${analysis}\n` : ''}
${architecture ? `## ARCHITECTURE\n${architecture}\n` : ''}
${prdContent ? `## PRD\n${prdContent}\n` : ''}

---
${IMPECCABLE_ANTIPATTERNS}
---
${branding?.fonts ? '' : FONT_SELECTION_PROCEDURE}
---

## THE AI SLOP TEST
Before finalizing any design decision, ask: "If I showed this to someone and said
'AI made this,' would they believe me immediately?"
If yes → redesign that element. The interface should make someone ask "how was this
made?" not "which AI template is this?"

---

## REQUIRED SECTIONS — ALL MANDATORY

### SECTION 1 — DESIGN TOKENS
Complete \`:root\` block using oklch() exclusively.
${branding?.colors
        ? `> User supplied palette — derive all tokens from those colors. Convert to oklch() 
> and generate the full scale (surface variants, hover states, disabled, muted).`
        : `> Choose colors that serve the product context. Derive them from the audience and 
> use case, NOT from what "looks like" the product type.`}

Include:
- Color: primary, secondary, accent, bg, surface, surface-raised, text-primary,
  text-secondary, text-muted, border, border-subtle, destructive, success, warning
- Typography: --font-display, --font-body, --font-mono; --text-xs through --text-5xl
- Spacing: --space-1 (4px) through --space-24 (96px)
- Radius: --radius-sm, --radius-md, --radius-lg, --radius-pill
- Shadows: --shadow-sm through --shadow-xl (multi-layer, always tinted toward brand hue)
- Z-index: --z-base, --z-sticky, --z-overlay, --z-modal, --z-toast
- Transitions: --transition-fast (150ms ease), --transition-base (250ms ease),
  --transition-decel (400ms cubic-bezier(0.16,1,0.3,1))

\`\`\`css
:root {
  /* Every token — no placeholders */
}
\`\`\`

### SECTION 2 — TYPOGRAPHY
- Google Fonts @import (exact URL)
- Justify each font choice: what physical object does it evoke? Why does it fit
  THIS brief specifically? (Not "it's elegant" — that's a dead answer.)
- Forbidden: any font from the reflex rejection list (unless user-supplied)

### SECTION 3 — THEME RATIONALE
- Chosen aesthetic name + 2-sentence emotional rationale tied to AUDIENCE context
- Dark or light + explicit reasoning from the themeHint above
- The ONE visual signature that makes this design memorable
- 5 Developer DOs / 5 Developer DON'Ts (concrete, CSS-level rules)

### SECTION 4 — LAYOUT SPECIFICATION
- Breakpoints: 375px / 768px / 1280px / 1920px with exact grid specs per breakpoint
- Key dimensions: sidebar width, header height, content max-width, panel min/max
- ASCII wireframe of the primary screen (use box-drawing characters)

### SECTION 5 — COMPONENT CSS
For each component: CSS code block + hover/focus/active/disabled states + notes.
NO placeholders. Every value references a token.

**5a. Navigation** (type appropriate to product: navbar, sidebar, bottom-nav)
**5b. Buttons** — primary, secondary, ghost, destructive (all 5 states each)
**5c. Form Controls** — input, textarea, select, checkbox, radio, toggle
**5d. Cards / Panels** — (remember: no side-stripe borders, no nested cards)
**5e. Data Display** — tables, stat blocks, badges, tags, progress
**5f. Feedback** — alerts, toasts, empty states, loading skeletons
**5g. Modals / Drawers** — only if product type warrants; justify their use
**5h. Scrollbars** — styled to match theme

### SECTION 6 — ANIMATION KEYFRAMES
At least 8 named @keyframes with utility classes. Include:
- Page/section entry (fade + translate)
- Exit
- Skeleton shimmer (no bounce easing anywhere)
- Hover lift (transform only)
- Press feedback (scale down)
- Success confirmation
- Error shake
- Loading spinner

\`\`\`css
@keyframes ... { }
.animate-enter { ... }
\`\`\`

### SECTION 7 — USER FLOWS (top 3 for this product type)
Numbered steps. Each step names: component shown + interaction trigger + next state.
Include error path for flows 1 and 2.

### SECTION 8 — ACCESSIBILITY
- WCAG 2.1 AA contrast ratios for key pairs (show actual computed values)
- Focus ring CSS (visible, branded, 2px offset minimum)
- ARIA landmark region list
- Keyboard navigation map for primary flows
- Reduced motion @media block

### SECTION 9 — DEVELOPER HANDOFF
- CSS methodology (BEM / CSS Modules / utility mapping)
- Animation library recommendation with justification (or "none needed")
- 5 rules the developer MUST NOT deviate from
- File structure recommendation for the token system

---

HARD CONSTRAINTS:
- Every color MUST be a complete oklch() value — no hex, no named colors
- Every size MUST reference a token — no magic numbers in component CSS
- No filler text, design-speak without specifics, or generic statements
- This spec must be 100% implementable with zero design decisions left open`;
  }

  // ── File header ─────────────────────────────────────────────────────────────

  private buildFileHeader(
    userRequest: string,
    productType: string,
    isRebrand: boolean,
    branding?: UserBranding,
  ): string {
    return [
      '---',
      isRebrand ? 'title: Rebrand Patch Specification' : 'title: UX Design Specification',
      `product_type: ${productType}`,
      `mode: ${isRebrand ? 'rebrand' : 'initial'}`,
      `generated_by: Sally (UXDesignerAgent v2)`,
      `generated_at: ${new Date().toISOString()}`,
      `user_supplied_palette: ${branding?.colors ? 'true' : 'false'}`,
      `user_supplied_fonts: ${branding?.fonts ? 'true' : 'false'}`,
      `request: "${userRequest.replace(/"/g, "'").substring(0, 120)}"`,
      '---',
      '',
      isRebrand
        ? '> 🎨 REBRAND PATCH — surgical token replacements only. Do not restructure layout.'
        : '> ⚠️  LIVE SPEC — streamed in real-time. Developer agent reads this file as it writes.',
      '',
    ].join('\n');
  }

  // ── Execute ─────────────────────────────────────────────────────────────────

  async execute(context: IAgentContext): Promise<string> {
    const userRequest = (context.metadata?.userRequest as string) || '';
    const branding = context.metadata?.branding as UserBranding | undefined;

    // Detect if this is a rebrand of existing work
    const isRebrand = Boolean(
      context.metadata?.isRebrand ||
      /\b(rebrand|re-brand|change.*color|update.*palette|new.*brand|swap.*color|replace.*color)\b/i.test(
        userRequest,
      ),
    );

    const productType = this.detectProductType(userRequest);

    this.log(
      `Sally running — product: ${productType}, mode: ${isRebrand ? 'REBRAND' : 'INITIAL'}, ` +
      `user palette: ${branding?.colors ? 'YES' : 'NO'}`,
    );

    const prompt = this.buildPrompt(context, productType, isRebrand, branding);

    // Determine output file
    const fileName = isRebrand ? 'REBRAND.md' : 'UX_DESIGN.md';
    const outputPath = context.workspaceRoot ? `${context.workspaceRoot}/${fileName}` : null;

    // Stream to file live so developer agent can begin reading early
    let buffer = '';
    let chunkCount = 0;
    const FLUSH_INTERVAL = 25;

    await this.llmService.streamGenerate(prompt, undefined, async (token: string) => {
      buffer += token;
      chunkCount++;

      if (outputPath && chunkCount % FLUSH_INTERVAL === 0) {
        try {
          await this.fileService.createFile(outputPath, buffer);
        } catch {
          // non-fatal during streaming
        }
      }
    });

    // Final authoritative write with YAML frontmatter
    if (outputPath) {
      const header = this.buildFileHeader(userRequest as string, productType, isRebrand, branding);
      const finalContent = header + buffer;
      try {
        await this.fileService.createFile(outputPath, finalContent);
        this.changeTracker.recordChange(outputPath, finalContent);
        this.log(`Sally → ${outputPath} (${finalContent.length} chars)`);
      } catch (err) {
        this.log(`Failed to write spec: ${err}`, 'error');
      }

      // If this is a rebrand, also write a token-only patch file for the developer
      if (isRebrand) {
        await this.writeTokenPatch(context, buffer, branding);
      }
    }

    return buffer;
  }

  // ── Token patch file for rebrands ────────────────────────────────────────────

  private async writeTokenPatch(
    context: IAgentContext,
    specBuffer: string,
    branding?: UserBranding,
  ): Promise<void> {
    if (!context.workspaceRoot) return;

    const patchLines: string[] = [
      '# Token Patch — Auto-extracted from REBRAND.md',
      '# Apply with: sed / find-replace in tokens.css or design-tokens.json',
      '',
      '## Quick-apply CSS variables',
      '```css',
      '/* Paste into :root {} in your tokens file */',
    ];

    if (branding?.colors) {
      for (const [key, value] of Object.entries(branding.colors)) {
        if (value) patchLines.push(`  --color-${key}: /* TODO: convert ${value} to oklch() */;`);
      }
    }

    patchLines.push('```', '', '## See REBRAND.md for full oklch() conversions and derived tokens.');

    const patchPath = `${context.workspaceRoot}/TOKEN_PATCH.md`;
    try {
      await this.fileService.createFile(patchPath, patchLines.join('\n'));
      this.changeTracker.recordChange(patchPath, patchLines.join('\n'));
    } catch {
      // non-fatal
    }
  }
}