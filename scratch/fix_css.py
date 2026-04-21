import sys

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Define color replacements
    replacements = {
        '--background: oklch(0.2046 0 0)': '--background: var(--vscode-sideBar-background)',
        '--foreground: oklch(0.9219 0 0)': '--foreground: var(--vscode-sideBar-foreground)',
        '--card: oklch(0.2686 0 0)': '--card: var(--vscode-editorWidget-background)',
        '--card-foreground: oklch(0.9219 0 0)': '--card-foreground: var(--vscode-editorWidget-foreground)',
        '--popover: oklch(0.2686 0 0)': '--popover: var(--vscode-editorWidget-background)',
        '--popover-foreground: oklch(0.9219 0 0)': '--popover-foreground: var(--vscode-editorWidget-foreground)',
        '--primary: oklch(0.7686 0.1647 70.0804)': '--primary: var(--vscode-button-background)',
        '--primary-foreground: oklch(0 0 0)': '--primary-foreground: var(--vscode-button-foreground)',
        '--secondary: oklch(0.2686 0 0)': '--secondary: var(--vscode-secondaryButton-background, rgba(130, 130, 130, 0.2))',
        '--secondary-foreground: oklch(0.9219 0 0)': '--secondary-foreground: var(--vscode-secondaryButton-foreground, var(--vscode-editor-foreground))',
        '--muted: oklch(0.2393 0 0)': '--muted: var(--vscode-editor-inactiveSelectionBackground)',
        '--muted-foreground: oklch(0.7155 0 0)': '--muted-foreground: var(--vscode-descriptionForeground)',
        '--accent: oklch(0.4732 0.1247 46.2007)': '--accent: var(--vscode-textLink-foreground)',
        '--accent-foreground: oklch(0.9243 0.1151 95.7459)': '--accent-foreground: var(--vscode-button-foreground)',
        '--destructive: oklch(0.6368 0.2078 25.3313)': '--destructive: var(--vscode-errorForeground)',
        '--destructive-foreground: oklch(1.0000 0 0)': '--destructive-foreground: #ffffff',
        '--border: oklch(0.3715 0 0)': '--border: var(--vscode-panel-border)',
    }

    # Apply replacements
    for old, new in replacements.items():
        content = content.replace(old, new)

    # Some additional layout fixes
    # Make input area resize safely
    content = content.replace(
        'textarea:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 2px hsla(var(--focus), 0.2); }',
        'textarea:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 1px var(--focus); }'
    )
    content = content.replace(
        'box-shadow: 0 8px 32px rgba(0,0,0,0.3);',
        'box-shadow: 0 4px 16px var(--vscode-widget-shadow);'
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Updated {filepath} successfully.")

process_file('d:/Verno/src/ui/templates/conversationTemplate.ts')
process_file('d:/Verno/src/panels/SDLCWebviewPanel.ts')
