create table if not exists public.items (
  id text primary key,
  data jsonb not null,
  created timestamptz not null default now()
);

alter table public.items enable row level security;
grant select, insert, update, delete on public.items to anon;

drop policy if exists "baca semua"   on public.items;
drop policy if exists "tambah semua" on public.items;
drop policy if exists "ubah semua"   on public.items;
drop policy if exists "hapus semua"  on public.items;

create policy "baca semua"   on public.items for select using (true);
create policy "tambah semua" on public.items for insert with check (true);
create policy "ubah semua"   on public.items for update using (true) with check (true);
create policy "hapus semua"  on public.items for delete using (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 20971520)
on conflict (id) do update set public = true, file_size_limit = 20971520;

drop policy if exists "media baca"   on storage.objects;
drop policy if exists "media unggah" on storage.objects;
drop policy if exists "media hapus"  on storage.objects;

create policy "media baca"   on storage.objects for select using (bucket_id = 'media');
create policy "media unggah" on storage.objects for insert with check (bucket_id = 'media');
create policy "media hapus"  on storage.objects for delete using (bucket_id = 'media');
