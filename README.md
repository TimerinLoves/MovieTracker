# SweetScreen

SweetScreen is a movie and TV tracker made for two. You search for whatever you
want to watch, keep a shared shelf of the things you are planning to see, the
things currently on screen, and the things you have already watched together,
and rate every entry the moment you finish it.

The whole thing is built around the two of you. Each person has their own
access key, so everyone sees the same lists but scores every movie privately.
You rate seven things - story, acting, visuals, music and sound, pacing,
rewatchability and emotional impact - and the site only shows a combined score
once you have both weighed in.

## Highlights

- Live search for movies and TV shows from a large, well-known catalog
- Shared shelves with drag & drop, so moving a title between "want to watch",
  "watching" and "watched" takes one gesture
- A combined rating model: your own scores stay private until both sides have
  rated, then a single average appears
- Nine soft color themes with a quick switcher in the top bar
- Everything you save lives in your own repository, so the data is yours and
  stays in sync across browsers

## How it works

SweetScreen is a small, fast single-page app. No accounts to create, no sign-up
wall - just two keys, one per person. Data and settings live in the browser,
and the watching lists are stored back into your own GitHub repository, which
also hosts the site itself on GitHub Pages.

## Tech

- React + Vite + TypeScript
- Drag & drop via @dnd-kit
- Web Crypto for key hashing and token encryption
- GitHub REST API for storage, GitHub Actions for deployment
- TMDb API for search