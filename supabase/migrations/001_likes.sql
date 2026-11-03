-- Migration 001 : likes des Pokémon.
--
-- Une ligne par Pokémon aimé (qu'il soit dans la liste ou non) : ses likes
-- restent s'il sort de la liste. N'altère aucune table existante.

create table if not exists public.pokemon_likes (
  pokemon_id integer primary key check (pokemon_id > 0),
  likes integer not null default 0 check (likes >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.pokemon_likes is 'Nombre de likes par Pokémon.';
comment on column public.pokemon_likes.pokemon_id is 'Numéro du Pokémon (PokéAPI).';
comment on column public.pokemon_likes.likes is 'Nombre de likes (jamais négatif).';
comment on column public.pokemon_likes.updated_at is 'Dernier like.';

-- Même sécurité que wishlist : aucun accès avec les clés publiques Supabase.
alter table public.pokemon_likes enable row level security;
revoke all on table public.pokemon_likes from anon, authenticated;
