'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Cloudflare Turnstile ("are you human") widget.
 *
 * The token it produces is handed to Supabase Auth, which verifies it against
 * Cloudflare using the secret key stored in the Supabase dashboard. The secret
 * never reaches the browser, so only the site key lives in this bundle.
 */

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** True when a site key is present. Builds without one skip the check entirely. */
export const isCaptchaConfigured = Boolean(TURNSTILE_SITE_KEY);

interface TurnstileApi {
    render(el: HTMLElement, opts: Record<string, unknown>): string;
    reset(id?: string): void;
    remove(id?: string): void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

let scriptPromise: Promise<void> | null = null;

/** Injects the Turnstile script once per page and resolves when its API is ready. */
function loadScript(): Promise<void> {
    if (typeof window === 'undefined') {
        return Promise.resolve();
    }
    if (window.turnstile) {
        return Promise.resolve();
    }
    if (!scriptPromise) {
        scriptPromise = new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
            const script = existing ?? document.createElement('script');
            script.addEventListener('load', () => resolve());
            script.addEventListener('error', () => {
                scriptPromise = null;
                reject(new Error('Failed to load Cloudflare Turnstile.'));
            });
            if (!existing) {
                script.src = SCRIPT_SRC;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
        });
    }
    return scriptPromise;
}

export interface TurnstileHandle {
    /** Clears the current token and asks for a fresh challenge. Tokens are single-use. */
    reset(): void;
}

interface TurnstileProps {
    /** Receives the solved token, or null when it expires, errors, or is reset. */
    onToken: (token: string | null) => void;
    /** Surfaced to the caller when the widget itself cannot run. */
    onError?: (message: string) => void;
    className?: string;
}

const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(function Turnstile(
    { onToken, onError, className },
    ref
) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);

    // Kept in refs so re-renders never force the widget to re-mount.
    const onTokenRef = useRef(onToken);
    const onErrorRef = useRef(onError);
    onTokenRef.current = onToken;
    onErrorRef.current = onError;

    useImperativeHandle(
        ref,
        () => ({
            reset() {
                onTokenRef.current(null);
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current);
                }
            },
        }),
        []
    );

    useEffect(() => {
        if (!TURNSTILE_SITE_KEY) {
            return;
        }

        let cancelled = false;

        loadScript()
            .then(() => {
                if (cancelled || !containerRef.current || !window.turnstile) {
                    return;
                }
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: TURNSTILE_SITE_KEY,
                    theme: 'auto',
                    size: 'flexible',
                    callback: (token: string) => onTokenRef.current(token),
                    'expired-callback': () => onTokenRef.current(null),
                    'timeout-callback': () => onTokenRef.current(null),
                    'error-callback': () => {
                        onTokenRef.current(null);
                        onErrorRef.current?.('Human check failed to load. Refresh and try again.');
                    },
                });
            })
            .catch((err: Error) => {
                if (!cancelled) {
                    onErrorRef.current?.(err.message);
                }
            });

        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, []);

    if (!TURNSTILE_SITE_KEY) {
        return null;
    }

    return <div ref={containerRef} className={className} />;
});

export default Turnstile;
