-- Schéma Supabase pour l'appli Todo (pipeline, contacts, sociétés, notes, tâches).
-- Le portefeuille (parc-data) reste géré par le pont Excel local : pas de table ici.
--
-- Choix : chaque enregistrement existant (opportunity, contact, company, note, task) a une
-- forme libre qui a grossi organiquement depuis des années (des dizaines de champs ad hoc,
-- différents selon le type). Plutôt que de deviner et figer chaque champ dans des colonnes
-- (au risque d'en perdre un à la migration), les colonnes ne portent que ce qui doit être
-- filtré/indexé/sécurisé ; le reste du document JSON existant est gardé intact dans `data`.

create extension if not exists pgcrypto;

-- une personne par compte Supabase Auth ; le nom affiché (pas d'email exposé aux collègues)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.opportunities (
  id text primary key,                         -- garde l'id existant (ex. "inst_...", "req_...")
  kind text not null,                           -- installation | request | prequal
  company text,
  stage text,
  request_id text,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb        -- le reste du document (tous les champs existants)
);
create index opportunities_company_idx on public.opportunities (company);
create index opportunities_request_id_idx on public.opportunities (request_id);
create index opportunities_deleted_idx on public.opportunities (deleted);

create table public.contacts (
  id text primary key,
  company text,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb
);
create index contacts_company_idx on public.contacts (company);

create table public.companies (
  id text primary key,
  name text,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb
);

create table public.notes (
  id text primary key,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb
);

create table public.tasks (
  id text primary key,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb
);

-- journal « qui a changé quoi » : remplace le sync-conflicts local par quelque chose de
-- commun à l'équipe, nominatif (profiles.display_name), jamais purgé automatiquement.
create table public.change_log (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  field text,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index change_log_entity_idx on public.change_log (entity_type, entity_id);

-- updated_at / updated_by posés par la base, jamais par le client (évite qu'un client
-- mal réglé ou compromis falsifie qui a écrit quoi)
create or replace function public.set_audit_fields()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now(); new.updated_at := now();
    new.created_by := auth.uid(); new.updated_by := auth.uid();
  else
    new.updated_at := now(); new.updated_by := auth.uid();
    new.created_at := old.created_at; new.created_by := old.created_by;
  end if;
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['opportunities','contacts','companies','notes','tasks'] loop
    execute format('create trigger %I_audit before insert or update on public.%I
      for each row execute function public.set_audit_fields();', t, t);
  end loop;
end $$;

-- RLS : équipe restreinte et de confiance, données partagées en lecture/écriture entre
-- tous les comptes authentifiés (pas de cloisonnement par personne) ; le trigger ci-dessus
-- garantit que l'attribution est fiable même avec un accès large.
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.contacts enable row level security;
alter table public.companies enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.change_log enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_write_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['opportunities','contacts','companies','notes','tasks'] loop
    execute format('create policy %I_team_rw on public.%I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end $$;

create policy change_log_read on public.change_log for select to authenticated using (true);
create policy change_log_insert on public.change_log for insert to authenticated with check (changed_by = auth.uid());

-- temps réel : les collègues voient les changements des autres sans recharger
alter publication supabase_realtime add table public.opportunities, public.contacts, public.companies, public.notes, public.tasks, public.change_log;
