-- CircuitCart — Step 1D-FIX: Hardened Product Images INSERT Policy
-- Migration: 20260906000010_harden_product_images_insert_rls.sql
-- Date: 2026-09-22

-- 1. Drop existing permissive INSERT policy on product_images
drop policy if exists "Sellers can insert images for their own products" on public.product_images;

-- 2. Create hardened INSERT policy requiring BOTH:
--    a) The product belongs to the authenticated user (seller_id = auth.uid())
--    b) The authenticated user's current database role in public.profiles is 'seller' or 'admin'
create policy "Sellers can insert images for their own products"
  on public.product_images
  for insert
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
      and p.seller_id = auth.uid()
    )
    and (select role from public.profiles where id = auth.uid()) in ('seller', 'admin')
  );
