-- Expand Palixia's book genres and make the Discover genre list content-driven.
-- All genres remain available in the author book form. Discover only displays genres
-- that have at least one published text book (queried from the book_cards view).

update public.genres set name = 'Science Fiction' where slug = 'sci-fi';

insert into public.genres (name, slug, sort) values
  ('Paranormal', 'paranormal', 11),
  ('Contemporary', 'contemporary', 12),
  ('Historical Fiction', 'historical-fiction', 13),
  ('Adventure', 'adventure', 15),
  ('Action', 'action', 16),
  ('Literary Fiction', 'literary-fiction', 17),
  ('Poetry', 'poetry', 18),
  ('Young Adult', 'young-adult', 19),
  ('Children''s Literature', 'childrens-literature', 20),
  ('Comedy', 'comedy', 21),
  ('Mythology & Folklore', 'mythology-folklore', 22),
  ('Spiritual & Inspirational', 'spiritual-inspirational', 23),
  ('Nonfiction', 'nonfiction', 24),
  ('Memoir & Biography', 'memoir-biography', 25),
  ('Personal Development', 'personal-development', 26)
on conflict (slug) do update
set name = excluded.name, sort = excluded.sort;
