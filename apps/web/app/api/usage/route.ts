import { NextResponse } from 'next/server';

import { FREE_TIER_LIMIT, FREE_TIER_LABEL, FREE_TIER_MODE } from '@/lib/entitlements';
import { bearerToken, getUsedToday, getUserFromRequest, isAuthConfigured } from '@/lib/supabase/server';

/**
 * GET /api/usage — how much of the free allowance the caller has left today.
 *
 * Read-only and advisory: the real limit is enforced in the API guard when a
 * run is actually requested. This only drives what the profile page displays.
 */
export async function GET(request: Request) {
    if (!isAuthConfigured) {
        return NextResponse.json({
            configured: false,
            signedIn: false,
            used: 0,
            limit: FREE_TIER_LIMIT,
            remaining: 0,
            label: FREE_TIER_LABEL,
            mode: FREE_TIER_MODE,
        });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
        return NextResponse.json({
            configured: true,
            signedIn: false,
            used: 0,
            limit: FREE_TIER_LIMIT,
            remaining: 0,
            label: FREE_TIER_LABEL,
            mode: FREE_TIER_MODE,
        });
    }

    const used = await getUsedToday(user.id, bearerToken(request) ?? undefined);

    return NextResponse.json({
        configured: true,
        signedIn: true,
        email: user.email,
        used,
        limit: FREE_TIER_LIMIT,
        remaining: Math.max(0, FREE_TIER_LIMIT - used),
        label: FREE_TIER_LABEL,
        mode: FREE_TIER_MODE,
    });
}
