# Palixia: setup guide (Phases 1 to 3)

Palixia is a reading and publishing site for books and comics. This version covers the first three phases of your specification: accounts and roles, the reader experience, and author publishing. Payments, reviews, withdrawals and the admin dashboard are not built yet.

**Important:** this code was written and syntax-checked, but it has not been run against a real database. Expect to fix a few small things on first deploy. Test each step below and send the exact error message if something fails.

## What works

**Foundation:** email and password accounts, three roles (reader, author, admin), a protected author area, mobile bottom navigation and desktop top navigation, a white and purple design system, friendly error messages (raw database errors are never shown).

**Reader:** home page (hero, featured, trending, new releases, genre tiles, popular authors), Discover with search, format and genre filters, sorting and Load more, categories, authors list, book page (Read Now, Save, Follow Author, chapters, about the author), a distraction-free reader with font size, light and dark mode, chapter bookmarks, progress bar, previous and next chapter, and "Continue reading" that returns you to where you stopped, plus a library (Currently Reading, Saved, Reading History), reader profile and public author pages.

**Comics:** a book is either `text` or `comic` (`books.book_type`). Comic chapters are ordered page images (table `chapter_pages`), shown full width and scrolled vertically, with the same progress, bookmark and chapter navigation as text books.

**Author:** sign up as an author or upgrade from a reader account, profile picture and bio, dashboard with stats and a books table, create and edit books with cover upload, text chapter editor, comic page uploader with reordering, draft and publish for both books and chapters, unpublish, and delete with confirmation.

**Security:** the database enforces all permissions with row level security, so the rules hold even if someone bypasses the website. Readers cannot change their role, feature a book or edit read counts. Authors can only touch their own books. Uploads go to a folder named after the signed-in user, with type and size limits set in storage.

## 1. Create the database (Supabase)

1. Create a free account at supabase.com and click **New project**. Name it `palixa`, set and save a database password, and pick the region nearest your readers.
2. Open **SQL Editor** > **New query**. Paste all of `supabase/schema.sql` and click **Run**. It should say "Success".
3. Optional but recommended: paste all of `supabase/seed.sql` into a new query and run it. This adds 5 fictional authors and 10 fictional books (8 text, 2 comics with placeholder art) so the site is not empty. To remove them later, run: `delete from auth.users where email like '%@sample.palixa.test';`
4. Open **Project Settings** > **API** and copy the **Project URL** and the **anon public** key.
5. For testing, open **Authentication** > **Providers** > **Email** and turn off "Confirm email" so new accounts can log in immediately. Turn it back on before a public launch.

**Starting over:** if the schema ever half-runs, paste `supabase/reset.sql` and run it, then run `schema.sql` again. Check with: `select count(*) from information_schema.tables where table_schema='public';` (should show 9 before seeding).

## Brand assets

One logo file is used everywhere: `public/brand/palixa-logo.png`, rendered only by `components/Logo.js` (sizes: header, auth, footer). Never set a width on it; height only. Favicon and app icons (`app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`, `public/brand/icon-*.png`) use the symbol from the same artwork. The site name is spelled "Palixia" to match the logo; the web address stays palixa.com. When your designer supplies a transparent PNG or SVG, replace `palixa-logo.png` (keep the name) and the symbol files.

## 2. Put the code on GitHub

Create a free GitHub account, create a **private** repository called `palixa-site`, and upload everything in this folder (not a `node_modules` folder, and not your `.env.local` file).

## 3. Publish the site (Vercel)

1. Sign in at vercel.com with GitHub, choose **Add New** > **Project**, and import `palixa-site`.
2. Add two **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, with the values from step 1.
3. Click **Deploy**. You get a temporary address like `palixa-site.vercel.app`.

If the build fails, copy the error from Vercel's build log and send it over.

## 4. Connect palixa.com (Hostinger)

1. In Vercel: project > **Settings** > **Domains** > add `palixa.com`. Vercel shows the DNS records to create, usually an **A** record for `@` and a **CNAME** for `www`. Use exactly what it shows.
2. In Hostinger hPanel: **Domains** > palixa.com > **DNS / Nameservers** > **DNS records**. Edit or add those records and remove any old `@` A record or `www` CNAME that conflicts.
3. Wait from a few minutes to a few hours. Vercel shows a green check when it works, and https is added automatically.
4. In Supabase: **Authentication** > **URL Configuration**. Set **Site URL** to `https://palixa.com` and add `https://palixa.com/**` to **Redirect URLs**.

## 5. Make yourself the admin

Sign up on the live site first. Then in Supabase **SQL Editor** run this with your own email:

```
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

The admin role exists but has no dashboard yet. Admins can already see every book, including drafts. The admin screens come in Phase 6.

## Test this journey after deploying

1. Sign up as a reader. Open a sample book, read a chapter, scroll, leave, and come back. "Continue reading" should resume near where you stopped.
2. Bookmark a chapter, tap Save on a book, follow an author, and check your Library.
3. Open a comic. The pages should scroll full width.
4. Sign up as an author. Add a profile picture on your profile page.
5. Create a text book with a cover, add two chapters, publish one chapter, publish the book, and open it as a reader.
6. Create a comic, upload three page images named 01, 02, 03, publish, and read it on your phone.

## Known limits

- Reads count the first time a signed-in reader opens any chapter of a book. Logged-out reading works but is not counted or saved.
- Saving a comic chapter replaces its pages (it deletes and re-inserts them), so if your connection drops mid-save, save again.
- Uploaded files are not scanned or resized. Keep covers under 2 MB and comic pages under 3 MB.
- No password reset page yet. Supabase can send reset emails, but the page to set a new password is not built.
- Search matches titles, authors, genres and tags with simple text matching, not typo-tolerant search.

## Next phases (not built)

Phase 4 payments and earnings, Phase 5 reviews and ratings, Phase 6 admin dashboard, Phase 7 polish. The tables and columns they need (`price`, `is_free`, `featured`, `status`) are already in the schema. Before real money moves, get a lawyer to review your terms of use, privacy policy, refund policy and creator agreement, and have the payment code reviewed for security.

## Running on your own computer (optional)

```
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev
```

## Google sign-in (optional)

The login and signup pages have a "Continue with Google" button. It stays inactive until you finish these steps. Email and password keep working either way.

1. In Google Cloud Console (console.cloud.google.com) create a project, open **APIs & Services** > **OAuth consent screen**, choose External, and fill in the app name (Palixia), your support email and developer email.
2. Open **Credentials** > **Create credentials** > **OAuth client ID**, type **Web application**.
3. Under **Authorized redirect URIs** add the callback address shown in Supabase at **Authentication** > **Providers** > **Google** (it looks like `https://YOUR-PROJECT.supabase.co/auth/v1/callback`). Under **Authorized JavaScript origins** add your site address (your Vercel address now, `https://palixa.com` later).
4. Copy the **Client ID** and **Client secret** into Supabase at **Authentication** > **Providers** > **Google**, turn it on and save.
5. In Supabase **Authentication** > **URL Configuration**, set Site URL to your site address and add it (and `https://palixa.com/**`) to **Redirect URLs**.
6. Test with a Google account that is not already on Palixia, then with one that is.

