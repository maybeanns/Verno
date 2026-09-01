/**
 * Carries user-attached files from the landing page into the workspace so the
 * debate and the PRD have real source material to work from.
 *
 * The workspace is reached by a `router.push` with query params, which cannot
 * carry file contents, so the extracted text is handed over in sessionStorage.
 * It is read once on arrival and posted to /api/debate as `attachments`.
 */

export interface Attachment {
    name: string;
    text: string;
}

export const ATTACHMENTS_STORAGE_KEY = 'producthive:attachments';

/** Only formats we can read as text are useful; PDFs and images are skipped. */
const TEXTUAL_EXTENSIONS =
    /\.(txt|md|markdown|csv|tsv|json|ya?ml|toml|html?|xml|sql|ts|tsx|js|jsx|py|rb|go|rs|java|cs|sh)$/i;

const MAX_FILE_BYTES = 200_000;

function isReadableAsText(file: File): boolean {
    return TEXTUAL_EXTENSIONS.test(file.name) || file.type.startsWith('text/');
}

/**
 * Extracts text from the files we can read. Returns the usable attachments and
 * the names of any that were skipped, so the UI can say so rather than
 * silently dropping what the user attached.
 */
export async function extractAttachments(
    files: File[]
): Promise<{ attachments: Attachment[]; skipped: string[] }> {
    const attachments: Attachment[] = [];
    const skipped: string[] = [];

    for (const file of files) {
        if (!isReadableAsText(file) || file.size > MAX_FILE_BYTES) {
            skipped.push(file.name);
            continue;
        }
        try {
            const text = await file.text();
            if (text.trim()) {
                attachments.push({ name: file.name, text });
            } else {
                skipped.push(file.name);
            }
        } catch {
            skipped.push(file.name);
        }
    }

    return { attachments, skipped };
}

export function saveAttachments(attachments: Attachment[]): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        if (attachments.length > 0) {
            sessionStorage.setItem(ATTACHMENTS_STORAGE_KEY, JSON.stringify(attachments));
        } else {
            sessionStorage.removeItem(ATTACHMENTS_STORAGE_KEY);
        }
    } catch {
        // Private browsing or a full quota — proceed without grounding.
    }
}

/** Reads the handed-over attachments. Returns [] when there are none. */
export function loadAttachments(): Attachment[] {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        const raw = sessionStorage.getItem(ATTACHMENTS_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(
            (a): a is Attachment =>
                !!a && typeof a.name === 'string' && typeof a.text === 'string'
        );
    } catch {
        return [];
    }
}
