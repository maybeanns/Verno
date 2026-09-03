import { checkAccess, type AccessResult } from '@/lib/entitlements';
import { bearerToken, getUsedToday, getUserFromRequest, recordUsage } from '@/lib/supabase/server';

/**
 * Gate for every route that can spend the shared server API key.
 *
 * The client decides which provider to ask for, so the client cannot be trusted
 * to decide whether it is allowed to. Any request that resolves to the shared
 * key is checked here: correct mode, signed in, and within quota.
 */

/** Provider values that mean "bill this to the server's own key". */
export function usesSharedKey(provider: string): boolean {
    return provider === 'test';
}

export interface GuardResult {
    ok: boolean;
    /** Present when ok is false — ready to return from the route. */
    response?: Response;
    /** Call after the work succeeds so a failed run does not burn the allowance. */
    commit?: () => Promise<void>;
}

function deny(result: AccessResult, status: number): Response {
    return new Response(
        JSON.stringify({ error: result.message, reason: result.reason }),
        { status, headers: { 'Content-Type': 'application/json' } }
    );
}

export async function guardSharedKeyUsage(
    request: Request,
    { provider, mode }: { provider: string; mode: string }
): Promise<GuardResult> {
    if (!usesSharedKey(provider)) {
        return { ok: true };
    }

    // Cheapest check first: the wrong mode is refused regardless of who is asking.
    const modeCheck = checkAccess({ mode, usingSharedKey: true, signedIn: false });
    if (!modeCheck.allowed && modeCheck.reason === 'own-key-required') {
        return { ok: false, response: deny(modeCheck, 403) };
    }

    const user = await getUserFromRequest(request);
    if (!user) {
        return {
            ok: false,
            response: deny(
                checkAccess({ mode, usingSharedKey: true, signedIn: false }),
                401
            ),
        };
    }

    const token = bearerToken(request) ?? undefined;
    const usedToday = await getUsedToday(user.id, token);
    const quotaCheck = checkAccess({ mode, usingSharedKey: true, signedIn: true, usedToday });
    if (!quotaCheck.allowed) {
        return { ok: false, response: deny(quotaCheck, 429) };
    }

    return {
        ok: true,
        commit: () => recordUsage(user.id, mode, token),
    };
}
