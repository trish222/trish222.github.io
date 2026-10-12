# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally (confirmed by the user):

1. **Recruiters and hiring managers** skimming for role, stack, employers, and proof in roughly thirty seconds. They need the record to be scannable without reading.
2. **Design-literate peers** — other engineers and designers — who will notice and judge the craft of the page itself.

The page is the first thing either audience sees after a résumé link or a GitHub profile.

## Product Purpose

A personal portfolio for Trish Nguyen that makes a Computer Science student / software engineer credible and memorable in one visit, and gives the visitor a working email address.

## Positioning

The site is itself the strongest work sample: a hand-built static page (no UI framework, no component library) whose visual system and WebGL background are authored rather than assembled.

## Operating Context

Static site deployed to GitHub Pages from this repository (`trish222.github.io`). Built with Vite 5 and Tailwind 4; no runtime dependencies ship. Visitors arrive from a résumé PDF, LinkedIn, or GitHub, usually on desktop during a review session, sometimes on a phone.

## Capabilities and Constraints

- Single page, anchor-navigated sections: index/about, experience, projects, skills, contact.
- No backend, no forms, no analytics. Contact is a `mailto:` link.
- Must work without WebGL (the animated field has a static fallback) and must respect `prefers-reduced-motion`.
- Stack is fixed by the existing codebase: Vite + vanilla ES modules + Tailwind 4 + plain CSS.

## Brand Commitments

- Name: **Trish Nguyen**. Voice: plain, specific, no marketing register.
- The visual direction is pinned by the user to two supplied reference images: experimental print work — smeared/misregistered oversized letterforms with technical run-code annotations, and a blue contour-moiré field on cold white paper.
- Explicitly retired, do not reintroduce: the Frutiger Aero glass-bubble theme, floating bubble decorations, and the bubble-lettering raster logo of the name.

## Evidence on Hand

Real and verified (source: `src/data/site.ts`, confirmed by the user as truth):

- Software Engineering Intern, SAS Institute — Customer Intelligence 360, Web & Mobile team.
- Student Web Developer, NCSU Engineering IT.
- B.S. Computer Science, NC State University, College of Engineering.
- Email `trishnguyen955@gmail.com`; GitHub `github.com/trish222`; LinkedIn `linkedin.com/in/trishnguyen`.

Absent — must not be fabricated:

- **Project work.** No real projects have been supplied. The Projects section ships as clearly-marked placeholder slots for the user to fill. Do not invent project names, descriptions, metrics, or links.
- No testimonials, press, employers, or credentials beyond the three above.
- **Dates are stale and unconfirmed.** `site.ts` carries 2021–2025 / 2024–Present, written before the current date. Treat the roles as true and the year ranges as needing the user's correction; do not silently update them.

## Product Principles

1. The record stays scannable no matter how expressive the page gets — a recruiter must find role, employer, and stack without reading prose.
2. Claims come only from the Evidence section; placeholders are labeled as placeholders rather than filled with plausible fiction.
3. The page is proof of craft, so authored technique (shaders, type, motion) beats installed technique.
4. Nothing ships that breaks without WebGL, without JavaScript's animation frame, or with reduced motion requested.

## Accessibility & Inclusion

No user-specific requirement was established beyond the general bar: WCAG AA contrast, full keyboard operability, visible focus, and a respected `prefers-reduced-motion`.
