-- Free-tier metering for PRD generation on the shared server API key.
--
-- Run this once against your Supabase project (SQL Editor, or `supabase db push`).
-- Rows are written by the server after a successful run; the daily allowance is
-- enforced by counting rows since the start of the current UTC day.

create table if not exists public.free_tier_usage (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    mode        text not null default 'Generate PRD',
    created_at  timestamptz not null default now()
);

-- The quota query filters on (user_id, created_at); this index serves it directly.
create index if not exists free_tier_usage_user_created_idx
    on public.free_tier_usage (user_id, created_at desc);

alter table public.free_tier_usage enable row level security;

-- A user may read their own usage, so the UI can show "0 of 1 left today".
drop policy if exists "read own usage" on public.free_tier_usage;
create policy "read own usage"
    on public.free_tier_usage
    for select
    using (auth.uid() = user_id);

-- Inserts are attributed to the caller. The server writes these; a client
-- cannot forge a row for someone else, and cannot delete rows to reset quota.
drop policy if exists "insert own usage" on public.free_tier_usage;
create policy "insert own usage"
    on public.free_tier_usage
    for insert
    with check (auth.uid() = user_id);

-- Deliberately no update or delete policy: quota rows are append-only.
