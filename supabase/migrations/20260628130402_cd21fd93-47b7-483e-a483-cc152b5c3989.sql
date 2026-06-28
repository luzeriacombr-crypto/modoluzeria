
CREATE TABLE public.stories_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories_schedule TO authenticated;
GRANT ALL ON public.stories_schedule TO service_role;
ALTER TABLE public.stories_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_read_all" ON public.stories_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "stories_admin_write" ON public.stories_schedule FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.cleaning_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_idx int NOT NULL CHECK (task_idx BETWEEN 0 AND 9),
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 5),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_idx, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaning_schedule TO authenticated;
GRANT ALL ON public.cleaning_schedule TO service_role;
ALTER TABLE public.cleaning_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cleaning_read_all" ON public.cleaning_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "cleaning_admin_write" ON public.cleaning_schedule FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.cleaning_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cleaning_settings TO authenticated;
GRANT ALL ON public.cleaning_settings TO service_role;
ALTER TABLE public.cleaning_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all" ON public.cleaning_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.cleaning_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.cleaning_settings (id, note) VALUES (1,
'Manter a limpeza do escritório e ordem nas mesas, salas e cozinha é trazer o cliente para o nosso universo. Transmitir capricho no visual, tato, olfato e paladar.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cleaning_schedule (task_idx, weekday, label) VALUES
(0, 0, 'Luana'), (0, 1, 'Rayfran'), (0, 2, 'Yara'), (0, 3, 'Larissa'), (0, 4, 'Moisés'), (0, 5, 'Jordânia'),
(1, 0, 'Yara'), (1, 4, 'Jordânia'),
(2, 1, 'Calebe'), (2, 4, 'Edna'),
(3, 2, 'Rayfran'),
(4, 0, 'Edna'), (4, 3, 'Luana'),
(5, 2, 'Luana'), (5, 5, 'Junior'),
(6, 0, 'Rayfran'), (6, 2, 'Larissa'), (6, 4, 'Calebe'),
(7, 0, 'Calebe'), (7, 2, 'Yara'), (7, 4, 'Jordânia'),
(8, 0, 'Moisés'), (8, 3, 'Moisés'),
(9, 5, 'Larissa')
ON CONFLICT (task_idx, weekday) DO NOTHING;
