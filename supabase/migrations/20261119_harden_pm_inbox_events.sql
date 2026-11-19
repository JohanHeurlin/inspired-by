-- Sprint 2 hardening for pm_inbox & pm_events (idempotent, zero PII)
-- Aligns live public.pm_events CHECK constraint + RLS INSERT policy with all 15
-- client trackEvent() names, and idempotently enforces RLS + write-only anon/authenticated privileges.

-- 1. public.pm_inbox: live table already enforces tighter CHECK constraints
--    (title 2..160, details <= 1500, source_page <= 160, category 2..120,
--    scope <= 120, submission_id 3..80) and column-level INSERT grants.
--    Ensure RLS stays enabled, drop any redundant draft constraints if present,
--    and revoke SELECT/UPDATE/DELETE from anon & authenticated.
do $$
begin
  if to_regclass('public.pm_inbox') is not null then
    alter table public.pm_inbox enable row level security;

    alter table public.pm_inbox drop constraint if exists pm_inbox_title_len;
    alter table public.pm_inbox drop constraint if exists pm_inbox_details_len;
    alter table public.pm_inbox drop constraint if exists pm_inbox_category_len;

    revoke select, update, delete on public.pm_inbox from anon, authenticated;
  end if;
end $$;

-- 2. public.pm_events: replace pm_events_event_check and RLS policy pm_events_anon_insert
--    so all 15 Sprint 1 + Sprint 2 event names are allowed while preserving exact
--    section/ref_host/device/tz checks and write-only anon/authenticated access.
do $$
begin
  if to_regclass('public.pm_events') is not null then
    alter table public.pm_events enable row level security;

    alter table public.pm_events drop constraint if exists pm_events_event_allowlist;
    alter table public.pm_events drop constraint if exists pm_events_section_len;
    alter table public.pm_events drop constraint if exists pm_events_event_check;

    alter table public.pm_events
      add constraint pm_events_event_check check (
        event = any (array[
          'visit', 'view', 'timeline_started', 'share_link', 'export_png',
          'trivia_streak', 'video_play',
          'share_png_native', 'share_duo_native',
          'roots_complete', 'roots_share', 'roots_copy',
          'steam_import', 'friend_match', 'credits_roll'
        ]::text[])
      ) not valid;

    drop policy if exists pm_events_anon_insert on public.pm_events;
    create policy pm_events_anon_insert
      on public.pm_events
      as permissive
      for insert
      to anon, authenticated
      with check (
        (event = any (array[
          'visit', 'view', 'timeline_started', 'share_link', 'export_png',
          'trivia_streak', 'video_play',
          'share_png_native', 'share_duo_native',
          'roots_complete', 'roots_share', 'roots_copy',
          'steam_import', 'friend_match', 'credits_roll'
        ]::text[]))
        and (char_length(section) <= 48)
        and (char_length(ref_host) <= 80)
        and (device = any (array['mobile', 'tablet', 'desktop', 'pwa']::text[]))
        and (char_length(tz) <= 48)
      );

    revoke select, update, delete on public.pm_events from anon, authenticated;
  end if;
end $$;
