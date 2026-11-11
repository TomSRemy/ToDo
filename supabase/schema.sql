-- Schéma Supabase pour l'appli Todo : uniquement les données d'équipe (pipeline, contacts,
-- sociétés, rendez-vous). Tâches et post-it restent personnels, gérés comme aujourd'hui
-- (IndexedDB + synchro GitHub propre à chacun) : aucune table ici, aucun changement pour eux.
-- Le portefeuille (parc-data) reste géré par le pont Excel local : pas de table ici non plus.
--
-- Choix : chaque enregistrement existant (opportunity, contact, company, meeting) a une forme
-- libre qui a grossi organiquement depuis des années (des dizaines de champs ad hoc, différents
-- selon le type). Plutôt que de deviner et figer chaque champ dans des colonnes (au risque d'en
-- perdre un à la migration), les colonnes ne portent que ce qui doit être filtré/indexé/sécurisé ;
-- le reste du document JSON existant est gardé intact dans `data`.

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

create table public.meetings (
  id text primary key,
  contact_id text,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  data jsonb not null default '{}'::jsonb
);
create index meetings_contact_id_idx on public.meetings (contact_id);

-- petites listes d'équipe partagées (ex. types de société) ; une ligne par liste
create table public.team_settings (
  key text primary key,
  updated_at timestamptz not null default now(),
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
  foreach t in array array['opportunities','contacts','companies','meetings'] loop
    execute format('create trigger %I_audit before insert or update on public.%I
      for each row execute function public.set_audit_fields();', t, t);
  end loop;
end $$;

-- team_settings n'a pas de created_at/created_by (une ligne par clé, jamais vraiment "créée" par quelqu'un)
create or replace function public.set_audit_fields_settings()
returns trigger language plpgsql as $$
begin
  new.updated_at := now(); new.updated_by := auth.uid();
  return new;
end; $$;
create trigger team_settings_audit before insert or update on public.team_settings
  for each row execute function public.set_audit_fields_settings();

-- RLS : équipe restreinte et de confiance, données partagées en lecture/écriture entre
-- tous les comptes authentifiés (pas de cloisonnement par personne) ; le trigger ci-dessus
-- garantit que l'attribution est fiable même avec un accès large.
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.contacts enable row level security;
alter table public.companies enable row level security;
alter table public.meetings enable row level security;
alter table public.team_settings enable row level security;
alter table public.change_log enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_write_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['opportunities','contacts','companies','meetings','team_settings'] loop
    execute format('create policy %I_team_rw on public.%I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end $$;

create policy change_log_read on public.change_log for select to authenticated using (true);
create policy change_log_insert on public.change_log for insert to authenticated with check (changed_by = auth.uid());

-- temps réel : les collègues voient les changements des autres sans recharger
alter publication supabase_realtime add table public.opportunities, public.contacts, public.companies, public.meetings, public.team_settings, public.change_log;

-- ============================================================================================================
-- 2026-11-11 · Droits d'équipe et historique (appliqué sur todo-beta via le SQL Editor)
-- Tout le monde lit, crée et modifie le partagé ; seule l'autrice ou l'auteur d'une ligne peut la supprimer
-- pour de bon (les autres la mettent à la corbeille : deleted = true, que n'importe qui peut annuler).
-- L'historique (change_log) est écrit par la base elle-même, champ par champ, jamais par l'appli ; il ne peut
-- être ni modifié ni effacé depuis l'appli. Un contact retiré de l'équipe (rendu privé) part avec son historique.
-- ============================================================================================================
do $$
declare t text;
begin
  foreach t in array array['opportunities','contacts','companies','meetings'] loop
    execute format('drop policy if exists %I_team_rw on public.%I;', t, t);
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('drop policy if exists %I_delete_own on public.%I;', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true);', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (true);', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (true) with check (true);', t, t);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using (created_by = auth.uid());', t, t);
  end loop;
end $$;

drop policy if exists change_log_insert on public.change_log;
create index if not exists change_log_at_idx on public.change_log (changed_at desc);

create or replace function public.log_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text; o jsonb; n jsonb;
begin
  if tg_op = 'INSERT' then
    insert into change_log(entity_type, entity_id, field, old_value, new_value, changed_by)
      values (tg_table_name, new.id, '(création)', null, null, auth.uid());
    return new;
  elsif tg_op = 'DELETE' then
    if tg_table_name = 'contacts' then
      delete from change_log where entity_type = 'contacts' and entity_id = old.id;
    end if;
    insert into change_log(entity_type, entity_id, field, old_value, new_value, changed_by)
      values (tg_table_name, old.id, '(suppression définitive)', null, null, auth.uid());
    return old;
  end if;
  if new.deleted is distinct from old.deleted then
    insert into change_log(entity_type, entity_id, field, old_value, new_value, changed_by)
      values (tg_table_name, new.id, case when new.deleted then '(mise à la corbeille)' else '(restauration)' end, to_jsonb(old.deleted), to_jsonb(new.deleted), auth.uid());
  end if;
  for k in select distinct key from (select jsonb_object_keys(coalesce(old.data,'{}'::jsonb)) as key union select jsonb_object_keys(coalesce(new.data,'{}'::jsonb))) s loop
    o := old.data -> k; n := new.data -> k;
    if o is distinct from n then
      insert into change_log(entity_type, entity_id, field, old_value, new_value, changed_by)
        values (tg_table_name, new.id, k, o, n, auth.uid());
    end if;
  end loop;
  return new;
end $$;

revoke all on function public.log_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['opportunities','contacts','companies','meetings'] loop
    execute format('drop trigger if exists %I_log on public.%I;', t, t);
    execute format('create trigger %I_log after insert or update or delete on public.%I for each row execute function public.log_change();', t, t);
  end loop;
end $$;

-- Avertissements du contrôle de sécurité Supabase (à appliquer via le SQL Editor)
alter function public.set_audit_fields() set search_path = public;
alter function public.set_audit_fields_settings() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2026-11-11 · Journal des erreurs de l'appli (envoyé par chaque appareil connecté à l'équipe, sans les données)
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid default auth.uid() references public.profiles(id) on delete set null,
  where_ text, message text, stack text, app_version text, user_agent text
);
alter table public.client_errors enable row level security;
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors for insert to authenticated with check (user_id = auth.uid());
drop policy if exists client_errors_read on public.client_errors;
create policy client_errors_read on public.client_errors for select to authenticated using (true);
create index if not exists client_errors_at_idx on public.client_errors (at desc);

-- 2026-11-11 · Recommandations de performance de Supabase (appliquées via le SQL Editor) : l'utilisateur connecté
-- calculé une fois par requête dans les règles, et un index sur chaque colonne « qui »
do $$
declare t text;
begin
  foreach t in array array['opportunities','contacts','companies','meetings'] loop
    execute format('drop policy if exists %I_delete_own on public.%I;', t, t);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using (created_by = (select auth.uid()));', t, t);
    execute format('create index if not exists %I_created_by_idx on public.%I (created_by);', t, t);
    execute format('create index if not exists %I_updated_by_idx on public.%I (updated_by);', t, t);
  end loop;
end $$;
drop policy if exists profiles_write_own on public.profiles;
create policy profiles_write_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid()));
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors for insert to authenticated with check (user_id = (select auth.uid()));
create index if not exists change_log_changed_by_idx on public.change_log (changed_by);
create index if not exists client_errors_user_id_idx on public.client_errors (user_id);
create index if not exists team_settings_updated_by_idx on public.team_settings (updated_by);
