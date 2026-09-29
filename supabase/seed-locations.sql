-- Salif (سلف) — neighborhood gazetteer seed (manual, not a migration).
-- Approximate real coordinates for Shibin El Kom (شبين الكوم), Monufia, Egypt.
insert into public.locations (name, name_ar, city, lat, lng) values
  ('City Center', 'وسط البلد', 'Shibin El Kom', 30.5545, 31.011),
  ('El-Bahri', 'البحري', 'Shibin El Kom', 30.559, 31.0085),
  ('El-Gaish St.', 'شارع الجيش', 'Shibin El Kom', 30.553, 31.0145),
  ('El-Khadra', 'الخضراء', 'Shibin El Kom', 30.549, 31.005),
  ('East Branch', 'الفرع الشرقي', 'Shibin El Kom', 30.551, 31.02),
  ('Shanawan', 'شنوان', 'Shibin El Kom', 30.5785, 31.023)
on conflict (name) do update set name_ar = excluded.name_ar, lat = excluded.lat, lng = excluded.lng;
