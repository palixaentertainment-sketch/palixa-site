-- Optional sample content: 5 fictional authors, 10 fictional books (8 text, 2 comics), 5 chapters each.
-- Run AFTER schema.sql, in the same SQL Editor. Safe to run twice: rows that exist are skipped.
-- All text and art here is made up for the prototype. Sample authors cannot sign in.
--
-- To remove every sample later, run:
--   delete from auth.users where email like '%@sample.palixa.test';

-- 1. Sample authors (the database creates their profiles automatically)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', a.id::uuid, 'authenticated', 'authenticated',
  a.username || '@sample.palixa.test', md5(random()::text), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('username', a.username, 'name', a.name, 'account', 'author'),
  now(), now()
from (values
  ('a1000000-0000-4000-8000-000000000001', 'adaeze_nwosu', 'Adaeze Nwosu'),
  ('a1000000-0000-4000-8000-000000000002', 'tunde_balogun', 'Tunde Balogun'),
  ('a1000000-0000-4000-8000-000000000003', 'ifeoma_eze', 'Ifeoma Eze'),
  ('a1000000-0000-4000-8000-000000000004', 'kelechi_obi', 'Kelechi Obi'),
  ('a1000000-0000-4000-8000-000000000005', 'zainab_musa', 'Zainab Musa')
) as a(id, username, name)
on conflict (id) do nothing;

-- 1b. Make sure every sample author has a profile (covers a re-run after a reset)
insert into public.profiles (id, name, username, role)
select a.id::uuid, a.name, a.username, 'author'
from (values
  ('a1000000-0000-4000-8000-000000000001', 'adaeze_nwosu', 'Adaeze Nwosu'),
  ('a1000000-0000-4000-8000-000000000002', 'tunde_balogun', 'Tunde Balogun'),
  ('a1000000-0000-4000-8000-000000000003', 'ifeoma_eze', 'Ifeoma Eze'),
  ('a1000000-0000-4000-8000-000000000004', 'kelechi_obi', 'Kelechi Obi'),
  ('a1000000-0000-4000-8000-000000000005', 'zainab_musa', 'Zainab Musa')
) as a(id, username, name)
on conflict (id) do nothing;

-- 2. Author bios and countries
update public.profiles p
set bio = a.bio, country = a.country
from (values
  ('a1000000-0000-4000-8000-000000000001', 'Nigeria', 'Writes crime and family drama set in Lagos.'),
  ('a1000000-0000-4000-8000-000000000002', 'Nigeria', 'Fantasy writer and comic scriptwriter.'),
  ('a1000000-0000-4000-8000-000000000003', 'Nigeria', 'Romance and short stories about homecomings.'),
  ('a1000000-0000-4000-8000-000000000004', 'Ghana', 'Horror and science fiction from West Africa.'),
  ('a1000000-0000-4000-8000-000000000005', 'Nigeria', 'Mystery novels about small neighbourhoods and big secrets.')
) as a(id, country, bio)
where p.id = a.id::uuid;

-- 3. Sample books
insert into public.books (id, author_id, title, description, genre_id, book_type, status, featured, reads, tags, is_sample)
select
  b.id::uuid, b.author::uuid, b.title, b.descr,
  (select g.id from public.genres g where g.slug = b.genre),
  b.btype, 'published', b.featured, (random() * 9000 + 300)::int, array[b.genre, 'sample'], true
from (values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'The Last House in Lagos', 'A landlord vanishes, and the last tenant on the street starts counting who benefits. (Sample book)', 'crime', 'text', true),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'The Girl Who Remembered Rain', 'In a village that has forgotten the sky, one girl remembers what water is for. (Sample book)', 'fantasy', 'text', true),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'After the Burial', 'Two families gather after a funeral, and the will is not the only thing left unread. (Sample book)', 'drama', 'text', true),
  ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', 'The Red Room', 'A hostel room that no student stays in for more than a week. (Sample book)', 'horror', 'text', false),
  ('b1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000003', 'Seven Days in Benin', 'A week-long visit home, an old classmate, and a wedding neither of them planned to attend. (Sample book)', 'romance', 'text', false),
  ('b1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000002', 'The King''s Shadow', 'A palace guard discovers the king casts no shadow at midnight. (Sample comic with placeholder art)', 'fantasy', 'comic', false),
  ('b1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000005', 'The Things We Never Said', 'Letters between a mother and daughter, found in a sewing box. (Sample book)', 'drama', 'text', false),
  ('b1000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000001', 'Blackwater', 'A river town, a missing ferry, and a ledger nobody will admit exists. (Sample comic with placeholder art)', 'mystery', 'comic', false),
  ('b1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000004', 'Before the Morning', 'Five short stories that all take place in the hour before sunrise. (Sample book)', 'short-stories', 'text', false),
  ('b1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000005', 'The Stranger at Number 12', 'Someone has moved into the empty house, and nobody saw them arrive. (Sample book)', 'mystery', 'text', false)
) as b(id, author, title, descr, genre, btype, featured)
on conflict (id) do nothing;

-- 4. Five chapters for every sample book (text for books, empty for comics: their pages come next)
insert into public.chapters (book_id, chapter_number, title, content, status, reads)
select
  s.id::uuid,
  gs.n,
  s.titles[gs.n],
  case when s.btype = 'text' then (
    select string_agg(
      case when gs.n = 1 and q.p = 0 then s.opening
      else pool.t[1 + ((gs.n * 7 + q.p * 3) % 12)] || ' ' ||
           pool.t[1 + ((gs.n * 5 + q.p * 3 + 1) % 12)] || ' ' ||
           pool.t[1 + ((gs.n * 3 + q.p * 3 + 2) % 12)]
      end, E'\n\n' order by q.p)
    from generate_series(0, 3) as q(p)
  ) end,
  'published',
  (random() * 2000 + 50)::int
from (values
  ('b1000000-0000-4000-8000-000000000001', 'text', array['The Empty Flat', 'Rent Day', 'A Key That Fits', 'The Neighbour', 'Closing the Books'], 'Mama Tobi had collected rent on the first of every month for thirty years, and on the first of October she did not come.'),
  ('b1000000-0000-4000-8000-000000000002', 'text', array['Dry Season', 'The Memory Keeper', 'What the Well Said', 'Cloud Road', 'First Drop'], 'By the ninth year without rain, the children of Okeluja no longer asked what water tasted like; only Amara still hummed the sound of it.'),
  ('b1000000-0000-4000-8000-000000000003', 'text', array['The Wake', 'Seating Arrangements', 'What Was Promised', 'The Cousin from Abroad', 'Fourth Day'], 'Nobody sat in the chair at the head of the table, and everybody noticed.'),
  ('b1000000-0000-4000-8000-000000000004', 'text', array['Room Nine', 'The Paint', 'Roll Call', 'Night Reading', 'Checkout'], 'The porter handed over the key to Room Nine without looking up, which was the first thing Chidi should have questioned.'),
  ('b1000000-0000-4000-8000-000000000005', 'text', array['Arrival', 'Ring Road', 'The Museum', 'Rain on Sakponba', 'Seventh Morning'], 'Efosa had promised herself seven days, no more, and the city seemed determined to make her break the promise.'),
  ('b1000000-0000-4000-8000-000000000006', 'comic', array['The Guard', 'Midnight Court', 'The Missing Shadow', 'Under the Throne', 'Dawn Watch'], ''),
  ('b1000000-0000-4000-8000-000000000007', 'text', array['The Sewing Box', 'Letter One', 'Letter Seven', 'What She Kept', 'Unsent'], 'The first letter was folded into a square so small it could have been mistaken for a button.'),
  ('b1000000-0000-4000-8000-000000000008', 'comic', array['The Ferry', 'Ledger', 'Low Tide', 'The Harbourmaster', 'Blackwater'], ''),
  ('b1000000-0000-4000-8000-000000000009', 'text', array['4:50 a.m.', 'The Baker', 'Night Bus', 'Generator Hum', 'First Light'], 'At ten to five, the only people awake in the city are the ones who cannot afford to sleep and the ones who cannot stop thinking.'),
  ('b1000000-0000-4000-8000-000000000010', 'text', array['Lights On', 'The Welcome', 'Bread and Questions', 'The Spare Key', 'Number Twelve'], 'The curtains at Number 12 had been drawn for two years, so when they opened on a Tuesday, the whole street felt it.')
) as s(id, btype, titles, opening)
cross join generate_series(1, 5) as gs(n)
cross join (select array[
  'The afternoon heat pressed against the windows until the glass seemed to hum.',
  'Somewhere down the street a generator coughed once and settled into its steady drone.',
  'She said nothing, because anything she said would have to be true.',
  'He counted the steps to the gate the way other people count prayers.',
  'The market noise rose and fell outside, a tide that never quite reached the house.',
  'Nobody in the room looked at the door, which is how everyone knew who they were waiting for.',
  'A single bulb swung overhead and made the shadows take turns.',
  'There are silences that are polite and silences that are warnings, and this was the second kind.',
  'The road ahead was red with dust and promised nothing.',
  'She folded the paper twice and held it as though it might still change its mind.',
  'Evening arrived the way it always did there: all at once, and with opinions.',
  'He remembered what his grandmother said about doors, and he knocked anyway.'
] as t) as pool
on conflict (book_id, chapter_number) do nothing;

-- 5. Four placeholder pages for every chapter of the two sample comics
insert into public.chapter_pages (chapter_id, page_number, image_url, alt)
select
  c.id,
  gp.p,
  'data:image/svg+xml;base64,' || replace(encode(convert_to(format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs><rect width="800" height="1200" fill="url(#g)"/><circle cx="%s" cy="%s" r="230" fill="#c4b0f5" fill-opacity="0.35"/><text x="60" y="150" font-family="Georgia,serif" font-style="italic" font-size="52" fill="#ffffff">%s</text><text x="60" y="215" font-family="Georgia,serif" font-size="34" fill="#ffffff" fill-opacity="0.85">Chapter %s</text><text x="60" y="1130" font-family="monospace" font-size="30" fill="#ffffff" fill-opacity="0.8">Sample page %s of 4. Placeholder art.</text></svg>',
    (array['#2e1065', '#4c1d95', '#312e81', '#3b0764'])[1 + ((c.chapter_number + gp.p) % 4)],
    (array['#6d28d9', '#7c3aed', '#8b5cf6', '#a855f7'])[1 + ((c.chapter_number * 2 + gp.p) % 4)],
    (150 + gp.p * 130)::text,
    (300 + ((c.chapter_number + gp.p) % 3) * 260)::text,
    replace(replace(b.title, '&', '&amp;'), '<', '&lt;'),
    c.chapter_number::text,
    gp.p::text
  ), 'UTF8'), 'base64'), E'\n', ''),
  'Sample page ' || gp.p || ' of chapter ' || c.chapter_number
from public.chapters c
join public.books b on b.id = c.book_id and b.is_sample and b.book_type = 'comic'
cross join generate_series(1, 4) as gp(p)
on conflict (chapter_id, page_number) do nothing;
