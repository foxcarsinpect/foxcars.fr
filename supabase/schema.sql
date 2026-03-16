-- ============================================================
-- FOXCARS — Schéma Supabase
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Table clients (liée aux utilisateurs Auth) ───────────
CREATE TABLE IF NOT EXISTS public.clients (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name    TEXT NOT NULL,
  company_name TEXT,
  phone        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Créer automatiquement un enregistrement client à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.clients (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 2. Table inspections ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspections (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  vehicle_make    TEXT NOT NULL,
  vehicle_model   TEXT NOT NULL,
  vehicle_year    INTEGER,
  vehicle_vin     TEXT,
  vehicle_plate   TEXT,
  vehicle_km      INTEGER,
  inspection_date DATE,
  inspector_name  TEXT DEFAULT 'FOXCARS',
  status          TEXT DEFAULT 'transmitted'
                  CHECK (status IN ('in_progress', 'completed', 'transmitted')),
  report_data     JSONB DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_inspections_updated_at ON public.inspections;
CREATE TRIGGER set_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3. Table photos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE NOT NULL,
  storage_path  TEXT NOT NULL,
  caption       TEXT,
  category      TEXT DEFAULT 'general',
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ── 4. Row Level Security (RLS) ─────────────────────────────
ALTER TABLE public.clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

-- Clients : accès à leur propre profil uniquement
CREATE POLICY "clients_own_profile"
  ON public.clients FOR ALL
  USING (auth.uid() = id);

-- Inspections : accès aux inspections du client connecté
CREATE POLICY "clients_own_inspections"
  ON public.inspections FOR ALL
  USING (auth.uid() = client_id);

-- Photos : accès aux photos liées aux inspections du client
CREATE POLICY "clients_own_photos"
  ON public.inspection_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.inspections
      WHERE id = inspection_id AND client_id = auth.uid()
    )
  );


-- ── 5. Storage bucket pour les photos ───────────────────────
-- À créer via le dashboard Supabase : Storage > New bucket
-- Nom : inspection-photos, Public : NON (privé)
--
-- Ou via SQL (si extension storage activée) :
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Lecture des photos : uniquement les utilisateurs connectés
CREATE POLICY "auth_users_read_photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'inspection-photos'
    AND auth.uid() IS NOT NULL
  );

-- Écriture : service role uniquement (app FoxCars)
-- Pas de policy INSERT ici → seule la service role key peut écrire


-- ── 6. Index pour les performances ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_inspections_client_id
  ON public.inspections(client_id);

CREATE INDEX IF NOT EXISTS idx_inspections_status
  ON public.inspections(status);

CREATE INDEX IF NOT EXISTS idx_photos_inspection_id
  ON public.inspection_photos(inspection_id);


-- ============================================================
-- NOTES D'INTÉGRATION POUR L'APP FOXCARS
-- ============================================================
-- L'app FoxCars doit utiliser la SERVICE ROLE KEY (jamais l'anon key)
-- pour insérer les données :
--
-- 1. Créer le client si inexistant (via Supabase Auth Admin API)
-- 2. INSERT INTO inspections (client_id, vehicle_make, ..., report_data)
-- 3. Upload photos dans Storage : inspection-photos/{inspection_id}/{filename}
-- 4. INSERT INTO inspection_photos (inspection_id, storage_path, caption, category)
-- ============================================================
