-- ============================================================
-- FOXCARS — Schéma espace admin
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Colonne role sur la table clients ────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client'
    CHECK (role IN ('client', 'admin'));

-- ── 2. Colonne email (dénormalisée pour affichage admin) ────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email TEXT;

-- ── 3. Mise à jour du trigger pour stocker l'email ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.clients (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 4. Fonction helper is_admin() ───────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── 5. Politiques RLS admin ──────────────────────────────────

-- Admin : accès complet sur clients (lecture + écriture)
DROP POLICY IF EXISTS "admin_all_clients" ON public.clients;
CREATE POLICY "admin_all_clients" ON public.clients FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin : accès complet sur inspections
DROP POLICY IF EXISTS "admin_all_inspections" ON public.inspections;
CREATE POLICY "admin_all_inspections" ON public.inspections FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin : accès complet sur photos
DROP POLICY IF EXISTS "admin_all_photos" ON public.inspection_photos;
CREATE POLICY "admin_all_photos" ON public.inspection_photos FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 6. Storage : admin peut uploader et supprimer des photos ─
DROP POLICY IF EXISTS "admin_upload_photos" ON storage.objects;
CREATE POLICY "admin_upload_photos" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "admin_update_photos" ON storage.objects;
CREATE POLICY "admin_update_photos" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'inspection-photos'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "admin_delete_photos" ON storage.objects;
CREATE POLICY "admin_delete_photos" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'inspection-photos'
    AND public.is_admin()
  );

-- ============================================================
-- APRÈS AVOIR APPLIQUÉ CE SQL :
-- 1. Créer votre compte admin dans Supabase Auth
--    (Authentication > Users > Invite user)
-- 2. Récupérer son UUID
-- 3. Exécuter :
--    UPDATE public.clients
--    SET role = 'admin', email = 'votre@email.fr'
--    WHERE id = '<votre-uuid>';
-- ============================================================
