-- =============================================================================
-- Artemis · 08 — Storage: bucket público de avatares
-- =============================================================================
-- Arquivos ficam em `avatars/<user_id>/<arquivo>`. O bucket é público: a leitura
-- acontece pela URL pública (`getPublicUrl`), que não passa por RLS. As políticas
-- abaixo controlam apenas listagem/escrita, sempre restritas à própria pasta —
-- assim ninguém consegue listar o bucket inteiro nem mexer no avatar alheio.
-- (O `config.toml` declara o mesmo bucket para o ambiente local; este INSERT
-- garante que ele também exista no Supabase Cloud após `supabase db push`.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "Avatares: cada usuária lista a própria pasta"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Avatares: cada usuária envia para a própria pasta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Avatares: cada usuária atualiza a própria pasta"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Avatares: cada usuária apaga da própria pasta"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
