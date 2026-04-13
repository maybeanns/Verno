/**
 * Webview security utilities — message type allowlist validation and CSP helpers.
 * All webview message handlers must call validateWebviewMessage() before acting on input.
 */

import { Logger } from './logger';

export interface WebviewMessage {
    type: string;
    [key: string]: unknown;
}

/**
 * Validate that a webview message conforms to an expected type allowlist.
 * Returns true (and narrows the type field) if valid, false if the message should be dropped.
 *
 * After validation, access additional fields via `(msg as any).field` or cast to a
 * typed sub-interface. This guards against prototype pollution and unknown message types.
 *
 * @example
 * if (!validateWebviewMessage(message, ALLOWED_TYPES, logger)) return;
 * const data = message as any; // access validated fields
 */
export function validateWebviewMessage<T extends WebviewMessage>(
    message: unknown,
    allowedTypes: readonly string[],
    logger?: Logger
): message is T {
    if (!message || typeof message !== 'object') {
        logger?.warn(`[WebviewSecurity] Invalid message format: ${JSON.stringify(message)}`);
        return false;
    }

    const msg = message as Record<string, unknown>;

    if (typeof msg.type !== 'string') {
        logger?.warn('[WebviewSecurity] Message missing required "type" field');
        return false;
    }

    if (!allowedTypes.includes(msg.type)) {
        logger?.warn(`[WebviewSecurity] Rejected unknown message type: "${msg.type}". Allowed: [${allowedTypes.join(', ')}]`);
        return false;
    }

    return true;
}

/**
 * Generate a cryptographically secure nonce for CSP use.
 * Produces a 16-byte hex string.
 */
export function generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}
