// Avant les migrations de l'E2E : rôles que Supabase fournit d'office et
// qu'un Postgres neuf (CI) n'a pas (les migrations font « revoke … from anon »).
import postgres from 'postgres'

const url =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:54329/wishlist_test'
const sql = postgres(url, { max: 1, onnotice: () => {} })
await sql
  .unsafe(
    `
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
  end
  $$;
`,
  )
  .simple()
await sql.end()
