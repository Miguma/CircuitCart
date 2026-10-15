# CircuitCart AI Product Verification v2.1 — Production Deployment Checklist
*Last Updated: Phase 3 Staging Validation (October 2026)*

---

## 1. Pre-Deployment Verification Summary
- [x] **Staging Simulation**: 20 active products + 1 sold-out product tested with full migration.
- [x] **Quarantine Rule**: Flowers and makeup listings demoted to `draft` + `rejected`.
- [x] **Grace Rule**: 18 active tech listings preserved with `grace_expires_at = now() + 7 days`.
- [x] **Sold-Out Behavior**: Sold-out listing retained `stock = 0`, excluded from public buyer view, visible in seller dashboard.
- [x] **Transition Gate**: Coordinated pre/post-migration gate in `/api/products/[id]/verify` prevents transition-window crashes.
- [x] **Integration Intact**: Carts, orders, Maya/demo payments, chat negotiations, and meetup downpayments verified.
- [x] **Test Suites**: 52/52 automated tests pass, 0 ESLint errors, Next.js build passes cleanly.

---

## 2. Production Environment Configuration
Ensure the following variables are present in the hosting environment (Vercel / Supabase Dashboard):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `MAYA_PUBLIC_KEY`
- `MAYA_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_REVERIFY_SECRET` (Optional for background cron re-verification)

---

## 3. Database Snapshot Command
```bash
# Snapshot live database prior to migration
pg_dump "$SUPABASE_DB_URL" -F c -b -v -f "circuitcart_pre_ai_verification_backup_$(date +%Y%m%d_%H%M%S).dump"
```

---

## 4. Execution Sequence
1. **Deploy Code**: Deploy `master` branch containing schema-aware queries and transition gates.
2. **Apply Migration**: Run `supabase/migrations/20261013130000_ai_product_verification.sql` via Supabase SQL Editor.
3. **Record Version**:
   ```sql
   insert into supabase_migrations.schema_migrations (version, name)
   values ('20261013130000', '20261013130000_ai_product_verification.sql')
   on conflict (version) do nothing;
   ```
4. **Audit Query**:
   ```sql
   select title, status, verification_status, verified_by_model, grace_expires_at
   from public.products
   order by verified_by_model, title;
   ```
5. **Re-verification Run**:
   ```bash
   curl -X POST "https://circuitcart.com/api/products/reverify-all?batchSize=10" \
     -H "x-admin-secret: $ADMIN_REVERIFY_SECRET"
   ```

---

## 5. Non-Destructive Rollback Procedure
```sql
begin;
drop trigger if exists trg_product_verification_guard on public.products;
drop trigger if exists trg_product_images_verification_invalidation on public.product_images;
drop trigger if exists trg_prevent_product_image_path_rewrite on public.product_images;

drop policy if exists "products_public_view_approved" on public.products;
create policy "products_public_view_standard"
  on public.products for select using (status = 'active' or seller_id = auth.uid());

-- Maintain quarantine on non-tech products
update public.products set status = 'draft'
where verified_by_model = 'legacy_rollout_quarantine' or verification_status = 'rejected';

-- Lift temporary grace expiry on legitimate tech products
update public.products set grace_expires_at = null
where verified_by_model = 'legacy_migration_grace' and status = 'active';
commit;
```
