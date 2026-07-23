-- Fabric motif metadata for scale-correct tiling on the quilt grid.
-- Run in Supabase SQL Editor after deploying the app update.

alter table public.fabrics
  add column if not exists motif_width_in numeric(10, 4),
  add column if not exists motif_height_in numeric(10, 4);

comment on column public.fabrics.motif_width_in is
  'Physical width in inches of one repeat of the fabric print (cropped tile).';
comment on column public.fabrics.motif_height_in is
  'Physical height in inches of one repeat of the fabric print (cropped tile).';
