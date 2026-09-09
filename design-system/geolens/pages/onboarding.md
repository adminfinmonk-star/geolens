# Onboarding / Signup funnel

> Overrides `design-system/geolens/MASTER.md` for onboarding surfaces only.

**Pattern:** Semrush-style 50/50 split — form left, pastel social-proof / product mock right.

## Rules

- Full-viewport split (`ob-split`), not max-width card stacks
- Progress = short segment bar (teal active), not numbered pills
- Primary CTA = solid black full-width (`ob-btn-black`); secondary = muted grey
- Choice options = light grey rounded rows (`ob-choice`), selected with teal border wash
- Right panel: mint→sky gradient + bottom data-wave; floating white card
- Accent stays GeoLens teal `#0f766e` (not Semrush purple)
- Typography: Space Grotesk display + DM Sans body (app fonts)
- Plan step: centered single column (`ob-root-centered`), “best plan match” IA
- Mobile ≤1024px: hide right visual panel

## Preview kinds

| Step | previewKind |
|------|-------------|
| Project / domain | `analysis` |
| Role | `testimonial` |
| Experience | `stats` |
| Focus / topics | `focus` |
| Plan | `none` (centered) |
