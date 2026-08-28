-- Storage buckets og danske kategorinavne.
--
-- Policies for begge buckets blev oprettet i RLS-migrationen, men selve
-- bucket'sne fandtes ikke. Uploads ville derfor fejle med "Bucket not found"
-- uanset at adgangsreglerne var på plads.
--
-- Sti-konventionen er givet af policyerne: første mappe i filnavnet skal
-- være brugerens uid, altså `{user_id}/{item_id}/{fil}`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Billeder er offentlige: en finder skal kunne se dem via et delt opslag.
  ('item-images', 'item-images', true, 10485760,
   array['image/png','image/jpeg','image/webp']),
  -- Kvitteringer er private. De indeholder pris, adresse og kortoplysninger.
  ('item-documents', 'item-documents', false, 10485760,
   array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Kategorierne lå på engelsk, mens resten af brugerfladen er dansk.
update public.categories set name = 'Elektronik' where name = 'Electronics';
update public.categories set name = 'Smykker'    where name = 'Jewelry';
update public.categories set name = 'Cykler'     where name = 'Bicycles';
update public.categories set name = 'Værktøj'    where name = 'Tools';
update public.categories set name = 'Dokumenter' where name = 'Documents';
update public.categories set name = 'Møbler'     where name = 'Furniture';
update public.categories set name = 'Tøj'        where name = 'Clothing';
update public.categories set name = 'Andet'      where name = 'Other';
