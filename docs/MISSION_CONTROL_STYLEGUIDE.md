---
version: alpha
name: Mission Control Operating Style
source: MagicPath Token Usage Module, Spine Group reference pack, taste-skill refinement pass
status: draft
---

# Mission Control Operating Style

Mission Control is moving toward a sharper operating-system surface: technical, editorial, warm, and disciplined. The visual language borrows from Spine Group's architectural memo style, then adapts it for live dashboard data.

The direction is not glassy SaaS. It is not a neon cockpit. It is a calm control document with strong data hierarchy.

## Principles

- Use flat planar fills, strict grids, and 1px hairline rules.
- Use sharp rectangles for dashboard panels, chart frames, buttons, inputs, and metric strips.
- Use orange as a signal, not decoration.
- Use colorful chart colors only when they clarify data grouping.
- Prefer structure over shadow: borders, dividers, gutters, and contrast create depth.
- Keep labels, metadata, dates, and numbers in mono.
- Keep headline hierarchy restrained. Let layout and contrast carry authority.
- Avoid emoji, decorative icons, gradients, rounded cards, glow, and glass blur.

## Typography

### Display

Use Inter for Mission Control headlines.

- Font: `Inter`
- Weight: `600` or `700`
- Tracking: `-0.055em` for large display
- Line-height: `0.98` to `1.05`
- Use one dominant headline per screen or module.

### Utility

Use PP Supply Mono for system language.

- Labels
- Navigation
- Dates
- Status markers
- Chart axes
- Metric captions
- Technical IDs

Utility text is uppercase and tracked open. It should feel like instrument labeling, not marketing copy.

## Color System

### Core Neutrals

- Warm white: `#FBF8F5`
- Off white: `#FAFAF9`
- Stone: `#EEE9E3`
- Border warm gray: `#B6B2AD`
- Muted annotation: `#A8A29E`
- Mid gray: `#797979`
- Dark text: `#1E1F20`
- Charcoal: `#252525`
- Near black: `#171717`

### Primary Signal

- Mission orange: `#FF4319`

Orange means dominant, selected, urgent, active, or the single most important data point. Do not use orange as a normal chart series unless that series is the one being emphasized.

### Secondary Chart Palette

These colors are intentionally more colorful than the neutral brand palette, but they stay crisp against warm-white and stone surfaces. Use them for graphs, model lines, agent series, project categories, status comparisons, and legends.

- Coral red: `#E23D28`
- Solar amber: `#F59E0B`
- Leaf green: `#2F9E44`
- Deep teal: `#007C89`
- Signal cyan: `#0891B2`
- Clear blue: `#2563EB`
- Ink indigo: `#4F46E5`
- Data violet: `#8B5CF6`
- Magenta rose: `#D9466F`
- Slate blue: `#64748B`

Palette rules:

- Use orange for the primary/dominant series, selected state, or alert state.
- Use secondary colors for peer series.
- Avoid using more than 6 chart colors in one view unless the chart is primarily a categorical legend.
- Pair colorful charts with neutral frames and mono labels.
- Prefer direct color blocks and 1px separators over translucent overlays.

## Layout

- Base page margin: `31px`
- Header bar height: `52px`
- Main max width: `1284px` for web dashboard surfaces
- Use CSS Grid for sibling groups and data layouts.
- Use 1px gaps on charcoal backgrounds for strict segmented structures.
- Use `+` registration marks sparingly at module corners, rails, and section starts.
- Use `////` as a technical separator detail in headers, not as decoration everywhere.

## Components

### Module Frame

A module frame is a sharp rectangle with:

- 1px charcoal border
- stone or warm-white fill
- optional top metadata bar
- grid-based interior
- no radius
- no shadow

### Metric Strip

Use a divided strip instead of separate cards.

- Border top and bottom
- Each metric divided by 1px vertical rules
- Mono label and note
- Mono or Inter value depending on density

### Chart Frame

Use a hairline chart frame:

- Y-axis in mono
- 1px grid rules
- flat stacked or grouped bars
- legend as segmented row or inline mono strip
- orange reserved for the dominant/selected surface

### Diagnostic Rail

Use a right-side or lower rail when a chart needs interpretation.

- One large highlighted word or value
- Mono percentage breakdown
- Divided rows
- A single `+` registration mark

## Do

- Keep one clear hierarchy per module.
- Use asymmetry when it helps interpretation.
- Use chart colors generously enough to make data scannable.
- Keep surfaces warm and flat.
- Use exact dates and concrete numbers.

## Do Not

- Do not use gradients.
- Do not use glassmorphism.
- Do not round dashboard panels.
- Do not use emoji.
- Do not overuse orange.
- Do not rely on shadows for structure.
- Do not use icons where mono text or a rule can do the job.
