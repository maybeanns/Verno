/**
 * Builds request headers for our API routes, attaching the Supabase access
 * token when the caller is signed in. The server needs it to verify the account
 * behind any run funded by the shared key.
 */
export function authHeaders(accessToken?: string | null): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }
    return headers;
}
