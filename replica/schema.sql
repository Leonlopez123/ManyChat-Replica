-- Schema v1: Comment-to-DM für ein eigenes Instagram-Konto (Single-Tenant)
-- Postgres 16. Alle Zeiten timestamptz (UTC).
-- Zugriffsschutz: keine RLS. Die App hat genau einen Admin; jede Seite und jede
-- Server-Action prüft die Admin-Session im Data-Layer (requireAdmin()).
-- Webhooks und Redirects sind öffentlich, prüfen aber Signatur bzw. nur Lese-/Log-Zugriff.

create extension if not exists pgcrypto;

-- Das verbundene Instagram-Konto (genau eine Zeile)
create table account (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null unique,               -- ID des eigenen Professional-Accounts
  username text not null,
  access_token_enc text not null,                -- AES-256-GCM, Schlüssel in ENCRYPTION_KEY
  token_expires_at timestamptz not null,         -- Long-lived Token: 60 Tage
  webhook_subscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index account_singleton on account ((true));

create table automations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references account(id) on delete cascade,
  name text not null,
  active boolean not null default false,
  post_scope text not null default 'single'
    check (post_scope in ('single','all','next')),
  media_id text,                                 -- bei 'single'; bei 'next' wird es beim ersten Treffer gesetzt
  media_permalink text,
  media_thumbnail_url text,
  activated_at timestamptz,                      -- für 'next': nur Posts danach
  keywords text[] not null default '{}',         -- normalisiert (klein, ohne Akzente), Enthält-Match
  exclude_keywords text[] not null default '{}',
  public_replies text[] not null default '{}',   -- bis 3, rotierend; leer = keine öffentliche Antwort
  opening_text text not null,                    -- "Hey {{vorname}}, sende ich dir gerne. Bist du denn schon gefolgt?"
  opening_button_label text not null default 'Ja',
  follow_gate boolean not null default true,
  follow_prompt_text text not null default '',
  follow_button_label text not null default 'Erledigt',
  max_follow_attempts int not null default 3 check (max_follow_attempts between 1 and 10),
  deliver_when_gate_exhausted boolean not null default true, -- nach max. Versuchen trotzdem liefern
  delivery_text text not null,
  delivery_url text not null,
  delivery_button_label text not null default 'Öffnen',
  bonus_text text,                               -- zweiter Lead-Magnet (optional)
  bonus_url text,
  bonus_button_label text default 'Zur Website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint single_needs_media check (post_scope <> 'single' or media_id is not null),
  constraint max_three_replies check (coalesce(array_length(public_replies,1),0) <= 3),
  constraint has_keywords check (coalesce(array_length(keywords,1),0) >= 1),
  constraint bonus_pair check ((bonus_url is null) = (bonus_text is null))
);
create index on automations (account_id);
create index on automations (active, post_scope);
create index on automations (media_id) where media_id is not null;

create table contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references account(id) on delete cascade,
  igsid text not null,                           -- Instagram-scoped ID des Kommentierers
  username text,
  first_name text,                               -- für {{vorname}}, sonst username
  is_follower boolean,                           -- letzter bekannter Stand, null = nie geprüft
  follower_checked_at timestamptz,
  last_interaction_at timestamptz,               -- öffnet das 24-h-Fenster
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, igsid)
);
create index on contacts (account_id, created_at desc);

create table runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  comment_id text not null unique,               -- ein Kommentar startet höchstens einen Run
  media_id text not null,
  comment_text text not null,
  status text not null default 'commented'
    check (status in ('commented','dm_sent','clicked','follow_pending','delivered','failed','expired')),
  follow_attempts int not null default 0,
  public_reply_id text,
  error text,
  dm_sent_at timestamptz,
  clicked_at timestamptz,
  delivered_at timestamptz,
  window_expires_at timestamptz,                 -- letzte Interaktion + 24 h
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, contact_id, media_id)   -- kein Doppelversand pro User und Post
);
create index on runs (contact_id);
create index on runs (automation_id, status);
create index on runs (automation_id, created_at desc);

-- Rohe Webhooks + gesendete Nachrichten: Dedupe und Fehler-Log
create table events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete set null,
  kind text not null
    check (kind in ('webhook_comment','webhook_postback','webhook_message','send','api_error','token_refresh')),
  dedupe_key text unique,                        -- z.B. comment:<id>, postback:<mid>; null für Sends
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on events (run_id);
create index on events (kind, created_at desc);

create table link_clicks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  target text not null check (target in ('delivery','bonus')),
  clicked_at timestamptz not null default now()
);
create index on link_clicks (run_id);

-- updated_at automatisch pflegen
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_account before update on account for each row execute function touch_updated_at();
create trigger t_automations before update on automations for each row execute function touch_updated_at();
create trigger t_contacts before update on contacts for each row execute function touch_updated_at();
create trigger t_runs before update on runs for each row execute function touch_updated_at();
