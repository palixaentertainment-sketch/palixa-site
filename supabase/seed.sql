-- Optional sample content: 5 fictional authors, 10 fictional books (8 text, 2 comics), 5 chapters each.
-- Run AFTER schema.sql, in the same SQL Editor. Safe to run twice: it stops if samples already exist.
-- All text and art here is made up for the prototype. Sample authors cannot sign in.
--
-- To remove every sample later, run:
--   delete from auth.users where email like '%@sample.palixa.test';

do $$
declare
  v_authors jsonb := '[
    {"id":"a1000000-0000-4000-8000-000000000001","username":"adaeze_nwosu","name":"Adaeze Nwosu","country":"Nigeria","bio":"Writes crime and family drama set in Lagos. Sample author for the Palixa prototype."},
    {"id":"a1000000-0000-4000-8000-000000000002","username":"tunde_balogun","name":"Tunde Balogun","country":"Nigeria","bio":"Fantasy writer and comic scriptwriter. Sample author for the Palixa prototype."},
    {"id":"a1000000-0000-4000-8000-000000000003","username":"ifeoma_eze","name":"Ifeoma Eze","country":"Nigeria","bio":"Romance and short stories about homecomings. Sample author for the Palixa prototype."},
    {"id":"a1000000-0000-4000-8000-000000000004","username":"kelechi_obi","name":"Kelechi Obi","country":"Ghana","bio":"Horror and science fiction from West Africa. Sample author for the Palixa prototype."},
    {"id":"a1000000-0000-4000-8000-000000000005","username":"zainab_musa","name":"Zainab Musa","country":"Nigeria","bio":"Mystery novels about small neighbourhoods and big secrets. Sample author for the Palixa prototype."}
  ]'::jsonb;

  v_books jsonb := '[
    {"t":"The Last House in Lagos","g":"crime","type":"text","a":0,"d":"A landlord vanishes, and the last tenant on the street starts counting who benefits. (Sample book)","c":["The Empty Flat","Rent Day","A Key That Fits","The Neighbour","Closing the Books"],"o":"Mama Tobi had collected rent on the first of every month for thirty years, and on the first of October she did not come."},
    {"t":"The Girl Who Remembered Rain","g":"fantasy","type":"text","a":1,"d":"In a village that has forgotten the sky, one girl remembers what water is for. (Sample book)","c":["Dry Season","The Memory Keeper","What the Well Said","Cloud Road","First Drop"],"o":"By the ninth year without rain, the children of Okeluja no longer asked what water tasted like; only Amara still hummed the sound of it."},
    {"t":"After the Burial","g":"drama","type":"text","a":2,"d":"Two families gather after a funeral, and the will is not the only thing left unread. (Sample book)","c":["The Wake","Seating Arrangements","What Was Promised","The Cousin from Abroad","Fourth Day"],"o":"Nobody sat in the chair at the head of the table, and everybody noticed."},
    {"t":"The Red Room","g":"horror","type":"text","a":3,"d":"A hostel room that no student stays in for more than a week. (Sample book)","c":["Room Nine","The Paint","Roll Call","Night Reading","Checkout"],"o":"The porter handed over the key to Room Nine without looking up, which was the first thing Chidi should have questioned."},
    {"t":"Seven Days in Benin","g":"romance","type":"text","a":2,"d":"A week-long visit home, an old classmate, and a wedding neither of them planned to attend. (Sample book)","c":["Arrival","Ring Road","The Museum","Rain on Sakponba","Seventh Morning"],"o":"Efosa had promised herself seven days, no more, and the city seemed determined to make her break the promise."},
    {"t":"The King''s Shadow","g":"fantasy","type":"comic","a":1,"d":"A palace guard discovers the king casts no shadow at midnight. (Sample comic with placeholder art)","c":["The Guard","Midnight Court","The Missing Shadow","Under the Throne","Dawn Watch"],"o":""},
    {"t":"The Things We Never Said","g":"drama","type":"text","a":4,"d":"Letters between a mother and daughter, found in a sewing box. (Sample book)","c":["The Sewing Box","Letter One","Letter Seven","What She Kept","Unsent"],"o":"The first letter was folded into a square so small it could have been mistaken for a button."},
    {"t":"Blackwater","g":"mystery","type":"comic","a":0,"d":"A river town, a missing ferry, and a ledger nobody will admit exists. (Sample comic with placeholder art)","c":["The Ferry","Ledger","Low Tide","The Harbourmaster","Blackwater"],"o":""},
    {"t":"Before the Morning","g":"short-stories","type":"text","a":3,"d":"Five short stories that all take place in the hour before sunrise. (Sample book)","c":["4:50 a.m.","The Baker","Night Bus","Generator Hum","First Light"],"o":"At ten to five, the only people awake in the city are the ones who cannot afford to sleep and the ones who cannot stop thinking."},
    {"t":"The Stranger at Number 12","g":"mystery","type":"text","a":4,"d":"Someone has moved into the empty house, and nobody saw them arrive. (Sample book)","c":["Lights On","The Welcome","Bread and Questions","The Spare Key","Number Twelve"],"o":"The curtains at Number 12 had been drawn for two years, so when they opened on a Tuesday, the whole street felt it."}
  ]'::jsonb;

  v_pool text[] := array[
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
  ];

  i int; n int; p int;
  b jsonb;
  v_author uuid;
  v_book uuid;
  v_ch uuid;
  v_txt text;
  v_para text;
  v_svg text;
  v_c1 text[] := array['#2e1065', '#4c1d95', '#312e81', '#3b0764'];
  v_c2 text[] := array['#6d28d9', '#7c3aed', '#8b5cf6', '#a855f7'];
begin
  if exists (select 1 from public.books where is_sample) then
    raise notice 'Sample content already exists. Nothing was added.';
    return;
  end if;

  -- Sample authors. Their password hash is random and invalid, so nobody can sign in as them.
  for i in 0 .. jsonb_array_length(v_authors) - 1 loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (v_authors -> i ->> 'id')::uuid,
      'authenticated',
      'authenticated',
      (v_authors -> i ->> 'username') || '@sample.palixa.test',
      md5(random()::text),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username', v_authors -> i ->> 'username', 'name', v_authors -> i ->> 'name', 'account', 'author'),
      now(),
      now()
    ) on conflict (id) do nothing;

    update public.profiles
      set bio = v_authors -> i ->> 'bio', country = v_authors -> i ->> 'country'
      where id = (v_authors -> i ->> 'id')::uuid;
  end loop;

  for i in 0 .. jsonb_array_length(v_books) - 1 loop
    b := v_books -> i;
    v_author := (v_authors -> ((b ->> 'a')::int) ->> 'id')::uuid;

    insert into public.books (author_id, title, description, genre_id, book_type, status, featured, reads, tags, is_sample)
    values (
      v_author,
      b ->> 't',
      b ->> 'd',
      (select id from public.genres where slug = b ->> 'g'),
      b ->> 'type',
      'published',
      i < 3,
      (random() * 9000 + 300)::int,
      array[b ->> 'g', 'sample'],
      true
    ) returning id into v_book;

    for n in 1 .. 5 loop
      v_txt := null;
      if b ->> 'type' = 'text' then
        v_txt := '';
        for p in 0 .. 3 loop
          if n = 1 and p = 0 then
            v_para := b ->> 'o';
          else
            v_para := v_pool[1 + ((n * 7 + p * 3) % 12)] || ' ' ||
                      v_pool[1 + ((n * 5 + p * 3 + 1) % 12)] || ' ' ||
                      v_pool[1 + ((n * 3 + p * 3 + 2) % 12)];
          end if;
          v_txt := v_txt || v_para || E'\n\n';
        end loop;
      end if;

      insert into public.chapters (book_id, chapter_number, title, content, status, reads)
      values (v_book, n, b -> 'c' ->> (n - 1), v_txt, 'published', (random() * 2000 + 50)::int)
      returning id into v_ch;

      if b ->> 'type' = 'comic' then
        for p in 1 .. 4 loop
          v_svg := format(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs><rect width="800" height="1200" fill="url(#g)"/><circle cx="%s" cy="%s" r="230" fill="#c4b0f5" fill-opacity="0.35"/><text x="60" y="150" font-family="Georgia,serif" font-style="italic" font-size="52" fill="#ffffff">%s</text><text x="60" y="215" font-family="Georgia,serif" font-size="34" fill="#ffffff" fill-opacity="0.85">Chapter %s</text><text x="60" y="1130" font-family="monospace" font-size="30" fill="#ffffff" fill-opacity="0.8">Sample page %s of 4. Placeholder art.</text></svg>',
            v_c1[1 + ((n + p) % 4)],
            v_c2[1 + ((n * 2 + p) % 4)],
            (150 + p * 130)::text,
            (300 + ((n + p) % 3) * 260)::text,
            replace(replace(b ->> 't', '&', '&amp;'), '<', '&lt;'),
            n::text,
            p::text
          );
          insert into public.chapter_pages (chapter_id, page_number, image_url, alt)
          values (
            v_ch,
            p,
            'data:image/svg+xml;base64,' || replace(encode(convert_to(v_svg, 'UTF8'), 'base64'), E'\n', ''),
            'Sample page ' || p || ' of chapter ' || n
          );
        end loop;
      end if;
    end loop;
  end loop;

  raise notice 'Added 5 sample authors and 10 sample books.';
end;
$$;
