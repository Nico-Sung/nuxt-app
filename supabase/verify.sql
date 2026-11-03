-- Vérifie supabase/init.sql.
--
-- SQL Editor → New query → coller ce fichier → Run.
-- Résultat attendu : un tableau dont toutes les lignes sont à ✅.
-- Ne modifie rien : les ajouts de test sont annulés, la liste reste telle quelle.

drop table if exists pg_temp.verification;
create temp table verification (
  etape integer,
  controle text,
  attendu text,
  obtenu text,
  ok text
);

do $$
declare
  rls boolean;
  cols text;
  inserted integer;
  dup_error text := 'accepté';
  full_error text := 'accepté';
  full_dup_error text := 'accepté';
  rows_after integer;
begin
  select c.relrowsecurity into rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'wishlist' and c.relkind = 'r';

  if rls is null then
    raise exception 'La table public.wishlist n''existe pas : exécute d''abord init.sql';
  end if;

  select string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position)
  into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'wishlist';

  -- Bloc annulé à la fin (savepoint) : rien n'est écrit pour de vrai.
  begin
    delete from public.wishlist;

    insert into public.wishlist (pokemon_id, name, sprite)
    select id, 'Test ' || id, 'https://example.test/' || id || '.png'
    from unnest(array[1, 4, 7, 25, 39, 133]) as id;
    get diagnostics inserted = row_count;

    -- doublon (liste pleine) : doit être signalé comme doublon
    begin
      insert into public.wishlist (pokemon_id, name, sprite)
      values (25, 'Pikachu', 'https://example.test/25.png');
    exception when others then
      full_dup_error := sqlstate || ' ' || sqlerrm;
    end;

    -- 7ᵉ Pokémon : doit être refusé
    begin
      insert into public.wishlist (pokemon_id, name, sprite)
      values (143, 'Snorlax', 'https://example.test/143.png');
    exception when others then
      full_error := sqlstate || ' ' || sqlerrm;
    end;

    -- doublon avec une place libre : doit être refusé
    delete from public.wishlist where pokemon_id = 133;
    begin
      insert into public.wishlist (pokemon_id, name, sprite)
      values (25, 'Pikachu', 'https://example.test/25.png');
    exception when others then
      dup_error := sqlstate || ' ' || sqlerrm;
    end;

    select count(*) into rows_after from public.wishlist;

    raise exception using errcode = 'VROLL', message = 'annulation des tests';
  exception when sqlstate 'VROLL' then
    null; -- tout ce qui précède dans ce bloc est annulé
  end;

  insert into verification values
    (1, 'Table public.wishlist', 'existe', 'existe', '✅'),
    (2, 'Colonnes',
       'pokemon_id integer, name text, sprite text, added_at timestamp with time zone',
       cols,
       case when cols = 'pokemon_id integer, name text, sprite text, added_at timestamp with time zone'
            then '✅' else '❌' end),
    (3, 'RLS activé', 'true', rls::text, case when rls then '✅' else '❌' end),
    (4, 'Ajout de 6 Pokémon', '6 ajoutés', inserted || ' ajoutés',
       case when inserted = 6 then '✅' else '❌' end),
    (5, '7ᵉ Pokémon', 'refusé : 23514 Liste pleine (6 max)', full_error,
       case when full_error = '23514 Liste pleine (6 max)' then '✅' else '❌' end),
    (6, 'Doublon quand la liste est pleine', 'refusé : 23505 (doublon)', full_dup_error,
       case when full_dup_error like '23505 %' then '✅' else '❌' end),
    (7, 'Doublon avec une place libre', 'refusé : 23505 (doublon)', dup_error,
       case when dup_error like '23505 %' then '✅' else '❌' end),
    (8, 'Lignes après les tests', '5', rows_after::text,
       case when rows_after = 5 then '✅' else '❌' end);
end;
$$;

select etape, controle, attendu, obtenu, ok
from verification
order by etape;
