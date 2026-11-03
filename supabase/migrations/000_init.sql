-- Migration 000 : schéma de la liste de Pokémon à capturer.
--
-- Appliquée par le runner (npm --prefix api run migrate), une seule fois,
-- et notée dans schema_migrations. Rejouable sans risque : c'était le
-- init.sql exécuté à la main dans Supabase avant l'arrivée des migrations.
-- Vérification : supabase/verify.sql.

-- ---------------------------------------------------------------------------
-- Table : un Pokémon par ligne (même forme que WishlistItem dans l'API)
-- ---------------------------------------------------------------------------

create table if not exists public.wishlist (
  -- clé primaire : un Pokémon ne peut être qu'une fois dans la liste
  pokemon_id integer primary key check (pokemon_id > 0),
  name text not null check (length(trim(name)) > 0),
  sprite text not null,
  added_at timestamptz not null default now()
);

comment on table public.wishlist is 'Pokémon à capturer (6 max).';
comment on column public.wishlist.pokemon_id is 'Numéro du Pokémon (PokéAPI).';
comment on column public.wishlist.name is 'Nom affiché (anglais).';
comment on column public.wishlist.sprite is 'URL de l''illustration officielle.';
comment on column public.wishlist.added_at is 'Date d''ajout à la liste.';

-- ---------------------------------------------------------------------------
-- Règle des 6 : la base refuse le 7ᵉ Pokémon, quel que soit le client
-- ---------------------------------------------------------------------------

create or replace function public.wishlist_enforce_max_size()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_size constant integer := 6;
begin
  -- Un ajout à la fois : deux insertions simultanées ne peuvent pas
  -- compter « 5 » en même temps et passer toutes les deux.
  perform pg_advisory_xact_lock(hashtext('public.wishlist'));

  -- Déjà dans la liste : on laisse la clé primaire signaler le doublon
  -- (même priorité que l'API : doublon avant liste pleine).
  if exists (select 1 from public.wishlist where pokemon_id = new.pokemon_id) then
    return new;
  end if;

  if (select count(*) from public.wishlist) >= max_size then
    raise exception 'Liste pleine (% max)', max_size
      using errcode = 'check_violation',
            hint = 'Retire un Pokémon avant d''en ajouter un autre.';
  end if;

  return new;
end;
$$;

drop trigger if exists wishlist_max_size on public.wishlist;
create trigger wishlist_max_size
  before insert on public.wishlist
  for each row execute function public.wishlist_enforce_max_size();

-- ---------------------------------------------------------------------------
-- Sécurité : aucun accès avec les clés publiques de Supabase
-- ---------------------------------------------------------------------------
-- Supabase expose les tables du schéma public via son API REST (clé anon).
-- RLS activé sans aucune policy + droits retirés : seuls le tableau de bord
-- et l'API Hono (connexion serveur) peuvent lire ou écrire.

alter table public.wishlist enable row level security;
revoke all on table public.wishlist from anon, authenticated;
