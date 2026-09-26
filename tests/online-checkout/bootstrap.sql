\set ON_ERROR_STOP on
-- Test-only Supabase shims. Run ONLY on a fresh disposable local database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create publication supabase_realtime;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key, bucket_id text, name text, owner uuid);
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
-- Mimic Supabase defaults; production financial migrations explicitly revoke writes.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
\ir ../../supabase/schema.sql
\ir ../../supabase/migrations/20260906000000_phase2_products_shops_storage.sql
\ir ../../supabase/migrations/20260906000001_phase2_security_patch.sql
\ir ../../supabase/migrations/20260906000002_phase3_cart_favorites.sql
\ir ../../supabase/migrations/20260906000003_phase4_orders_checkout.sql
\ir ../../supabase/migrations/20260906000004_phase4_order_integrity_patch.sql
\ir ../../supabase/migrations/20260906000005_phase5_messaging.sql
\ir ../../supabase/migrations/20260906000006_phase5_messaging_security_patch.sql
\ir ../../supabase/migrations/20260906000007_phase6a_seller_verification.sql
\ir ../../supabase/migrations/20260906000008_phase6a1_automated_verification.sql
\ir ../../supabase/migrations/20260906000009_admin_rls_policies.sql
\ir ../../supabase/migrations/20260906000010_harden_product_images_insert_rls.sql
\ir ../../supabase/migrations/20260906000011_phase7_reviews_and_ratings.sql
\ir ../../supabase/migrations/20260906000012_phase8_persistent_notifications.sql
\ir ../../supabase/migrations/20260906000013_phase9_payment_and_fulfillment.sql
\ir ../../supabase/migrations/20260906000014_phase10_online_payment_transactions.sql
\ir ../../supabase/migrations/20260906000015_phase11_online_checkout_foundation.sql
