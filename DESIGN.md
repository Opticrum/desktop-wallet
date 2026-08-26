# ProMobile Balance Dashboard — High-Fidelity Recreation Spec

## 0. Purpose

This document distills the visual information in the reference image into a page spec that can be implemented directly. The goal is not to reuse the brand in the image, but to recreate the same composition, density, hierarchy, and material from this document alone — in a browser or a desktop WebView.

- **Reference image baseline size:** `1024 × 768 px`
- **Target page type:** desktop payment / wallet back-office balance page
- **Target visual tolerance:** key structural positions within `±4 px`; color, weight, and shadow may differ slightly by font and renderer
- **Visual check:** a `1024 × 768` static HTML screenshot was generated from this document and overlaid against the reference; §19 records differences and corrections
- **Design mode:** defines only the light desktop version in the reference; do not extrapolate a dark theme or a mobile layout from this image
- **Implementation freedom:** React, Vue, or static HTML are all fine; charts may be SVG or CSS. Implementation choice does not affect acceptance

Sizes in this document fall into two classes:

- **Observed values:** edges or ratios that can be estimated directly from the `1024 × 768` reference
- **Inferred values:** reasonable implementation values derived because of image scaling, anti-aliasing, or missing source assets

When the two conflict, preserve overall proportion, visual hierarchy, and the rhythm of whitespace — do not chase individual pixels mechanically.

---

## 1. Visual summary

The page is a large rounded desktop-app window floating on a light blue-gray background. Inside the window there is no traditional top bar. Instead it splits into:

1. **Fixed left navigation:** an independent white rounded panel containing brand, six nav items, a promo card, and a help entry.
2. **Right workspace:** a full-width balance and quick-action card on top; below it, a payment-history main card and a statistics side card.
3. **Soft float:** almost no hard borders. Hierarchy comes from a very light gray-violet ground, white cards, fine shadows, and large radii.
4. **Single accent:** high-saturation royal blue owns active states, buttons, links, and key icons. Orange, cyan, and violet serve data classification only.
5. **Financial information hierarchy:** the balance figure is largest; card titles next; tables and labels stay compact and restrained.

Keywords: `clean fintech`, `soft dashboard`, `rounded desktop shell`, `royal blue accent`, `low-contrast borders`, `compact data table`.

---

## 2. Baseline canvas and overall coordinates

### 2.1 Canvas

| Item | Baseline |
|---|---:|
| Viewport | `1024 × 768 px` |
| Page background | full screen |
| App window top-left | `x=51, y=56` |
| App window size | `922 × 656 px` |
| App window bottom-right | `x=973, y=712` |
| App window outer radius | `22 px` |

The app window occupies roughly:

- Width: `90.0%`
- Height: `85.4%`
- Horizontally centered
- About `7.3vh` from the top

Recommended scale strategy:

```text
scale = min((viewportWidth - 48) / 922, (viewportHeight - 48) / 656, 1)
```

At `1024 × 768` and above, keep `scale=1`. Smaller viewports may scale the whole shell proportionally — do not reflow cards or switch to a mobile layout.

### 2.2 Regions inside the app window

The shell itself uses a very light gray-white / pale-violet ground and about `11 px` of inner padding.

| Region | Top-left | Size | Radius |
|---|---:|---:|---:|
| Left sidebar | `62, 67` | `178 × 634` | `15 px` |
| Right workspace | `248, 67` | `714 × 634` | — |
| Top balance card | `248, 67` | `714 × 196` | `15 px` |
| Payment-history card | `248, 272` | `474 × 429` | `15 px` |
| Statistics card | `730, 272` | `232 × 429` | `15 px` |

Core gaps:

- App-window padding: `11 px`
- Sidebar to workspace: `8 px`
- Top card to lower cards: `9 px`
- Lower left/right cards: `8 px`

These tight gaps make the three content blocks feel embedded in one desktop app, not scattered web cards.

---

## 3. Design tokens

The colors below are implementation values inferred from the reference. Define them as variables in one place; do not scatter hardcoded values.

### 3.1 Color

```css
:root {
  /* Foundations — values corrected by sampling the 1024×768 reference */
  --page-bg: #e1ecf0;
  --shell-bg: #f7f6fb;
  --surface: #ffffff;
  --surface-soft: #f4f6ff;
  --surface-blue: #eef1ff;
  --surface-warm: #fff4ec;
  --surface-yellow: #fff8d9;
  --surface-promo: #edeffb;

  /* Text */
  --text-strong: #111218;
  --text-primary: #202127;
  --text-secondary: #6f7280;
  --text-tertiary: #a5a7b1;
  --text-inverse: #ffffff;

  /* Brand and semantic */
  --blue-600: #3f61ff;
  --blue-500: #3f61ff;
  --blue-100: #eaf0ff;

  /* Sidebar nav icon grounds (observed — do not swap for other pastels) */
  --nav-bg-overview: #e5e4ff;
  --nav-bg-apps: #cfedff;
  --nav-bg-app-overview: #ffe4cd;
  --nav-bg-orders: #fff3d6;
  --nav-fg-overview: #4f46e5;
  --nav-fg-apps: #0891b2;
  --nav-fg-app-overview: #ea580c;
  --nav-fg-orders: #ca8a04;
  --cyan-500: #15b8ed;
  --orange-500: #ff6b1a;
  --orange-100: #fff0e6;
  --violet-600: #633de8;
  --violet-100: #f1ecff;
  --yellow-400: #ffd735;
  --yellow-100: #fff7ce;

  /* Lines and controls */
  --line: #eceef4;
  --line-strong: #e2e5ed;
  --icon-muted: #6f7481;
  --icon-dark: #17191f;
}
```

Color rules:

- Primary buttons, selected nav, selected tabs, and clickable links all use `--blue-600`.
- Orange means Debit only; violet means Bonus only; cyan means Invoice only.
- Yellow is for the plan tag and the promo-card lightning icon — not for the primary CTA.
- Body copy must not use pure black; the largest balance and total stats may approach `#111218`.
- Cards are distinguished by white fill, not by strong borders.

### 3.2 Radii

```css
--radius-shell: 22px;
--radius-panel: 15px;
--radius-action: 13px;
--radius-button: 9px;
--radius-icon: 8px;
--radius-pill: 999px;
```

Rules:

- The three main content cards and the left sidebar share `15 px`.
- Quick-action cards: `13 px`.
- Menu icon grounds and small buttons: `8–10 px`.
- Tags, the theme-toggle track, and legends use a pill radius.

### 3.3 Shadows

```css
--shadow-shell:
  0 24px 45px rgba(74, 104, 123, 0.14),
  0 5px 16px rgba(74, 104, 123, 0.06);

--shadow-active:
  0 12px 22px rgba(49, 91, 245, 0.28),
  0 3px 8px rgba(49, 91, 245, 0.16);

--shadow-icon:
  0 5px 12px rgba(49, 91, 245, 0.20);

--shadow-tooltip:
  0 6px 18px rgba(17, 18, 24, 0.18);
```

Do not put a visible shadow on every white card. Main cards separate from `--shell-bg` by luminance; the shell shadow is the page's primary sense of float.

### 3.4 Spacing scale

Base unit is `4 px`:

```text
4 / 8 / 12 / 16 / 20 / 24 / 32
```

Common values:

- Icon to text: `10–12 px`
- Card inner left/right padding: `20 px`
- Top-card inner left/right padding: `20 px`
- Table-row vertical padding: `12–13 px`
- Block title to content: `22–28 px`

---

## 4. Type system

The reference uses a geometric modern sans. Prefer:

```css
font-family:
  "Inter",
  "SF Pro Display",
  "SF Pro Text",
  "Segoe UI",
  Arial,
  sans-serif;
```

If Inter cannot load, use SF Pro on macOS and Segoe UI on Windows. Figures should use tabular lining:

```css
font-variant-numeric: tabular-nums;
```

### 4.1 Type scale

| Use | Size | Line height | Weight |
|---|---:|---:|---:|
| Brand wordmark | `15 px` | `20 px` | `800` |
| Largest balance integer | `38 px` | `42 px` | `600` |
| Largest balance decimal | `20 px` | `28 px` | `400` |
| Donut-center total | `27 px` | `31 px` | `700` |
| Card title | `13 px` | `18 px` | `700` |
| Tab | `13 px` | `18 px` | `500` |
| Nav item | `11 px` | `16 px` | `500` |
| Ordinary label | `10 px` | `15 px` | `400–500` |
| Table header | `9 px` | `13 px` | `600` |
| Table body | `9 px` | `13 px` | `400–600` |
| Micro copy | `8 px` | `12 px` | `400` |

### 4.2 Type details

- Titles and key figures: letter-spacing `-0.02em`
- Body: `0`
- All-caps wordmark may use `0.02em`
- Integer and decimal of an amount must share one baseline; the decimal is lighter
- Table amounts are right-aligned and bold
- Do not use ultra-light weights; muted gray text lowers hierarchy through color, not weight

---

## 5. Page background and app shell

### 5.1 Page background

A flat light blue-gray `#e1ecf0`. The reference has a slight luminance shift around the window; a very restrained radial gradient may simulate it:

```css
background:
  radial-gradient(
    ellipse at 50% 42%,
    #e8f3f6 0%,
    #e1ecf0 58%,
    #dbe8ee 100%
  );
```

No obvious texture, grid, or colored bloom.

### 5.2 App shell

- Size: `922 × 656 px`
- Background: `--shell-bg`
- Radius: `22 px`
- Padding: `11 px`
- Shadow: `--shadow-shell`
- Overflow: hidden
- Do not draw a system title bar or traffic-light controls

The window should read as one milky desktop product, not an ordinary container on a web page.

---

## 6. Left navigation

### 6.1 Container

- Coordinates: `62, 67`
- Size: `178 × 634 px`
- Background: white
- Radius: `15 px`
- Inner left/right padding: `12 px`
- Layout: vertical flex

Content in four bands:

1. Brand
2. Primary nav
3. Spacer that eats remaining space
4. Promo card + Help

### 6.2 Brand

Brand sits around `x=74, y=86`:

- Visible size about `108 × 17 px`
- About `18 px` from the top of the sidebar
- Wordmark: `PRO` (blue) + `MOBILE` (dark)
- All caps, bold
- No space between the two parts, or only a `1–2 px` optical gap

The letter O is a brand mark. **Do not** substitute a plain letter O or an emoji. SVG construction notes:

```svg
<!-- Viewport 18×18, sits between "PRO" and "MOBILE" -->
<g transform="translate(0,0)">
  <circle cx="9" cy="9" r="7" fill="none" stroke="#3f61ff" stroke-width="2.2"/>
  <circle cx="9" cy="9" r="3.5" fill="#ffffff"/>
  <path d="M9 2.5 L10.2 5.2 L9 4.8 L7.8 5.2 Z" fill="#3f61ff"/>
</g>
```

- Outer ring diameter about `14 px`, stroke `#3f61ff`
- Inner white circle diameter about `7 px`
- Top mark is an inverted small triangle / droplet, `2.4 px` wide × `2.8 px` high
- "PRO" color `#3f61ff`, "MOBILE" color `#111218`, letter-spacing `0.02em`

### 6.3 Collapse control

On the right edge of the sidebar, around `x=230, y=104`:

- `18 × 18 px` white circular button
- Left-pointing chevron in the center
- Half of the button sits in the gap between the two columns
- Light border or shadow
- Icon size `10 px`

### 6.4 Primary nav

Primary nav starts around `y=123`. Center y of the six items is about:

```text
136 / 175 / 213 / 252 / 291 / 330
```

Default nav item:

- Height: `32 px`
- Left/right padding: `12 px`
- Icon-to-text gap: `10 px`
- Icon ground: `28 × 28 px`
- Glyph: `14–15 px`
- Label: `11 px / 500`

Nav content:

| Item | Icon meaning | Icon-ground token | Icon-color token |
|---|---|---|---|
| Overview | Home (stroked house) | `--nav-bg-overview` `#e5e4ff` | `--nav-fg-overview` `#4f46e5` |
| My Apps | Four-up grid | `--nav-bg-apps` `#cfedff` | `--nav-fg-apps` `#0891b2` |
| App Overview | Clock / pie | `--nav-bg-app-overview` `#ffe4cd` | `--nav-fg-app-overview` `#ea580c` |
| Balance | Wallet (stroke) | solid `--blue-600` | `#ffffff` |
| My Orders | Document / receipt | `--nav-bg-orders` `#fff3d6` | `--nav-fg-orders` `#ca8a04` |
| New order | Document with plus | whole row as primary button | white |

**Hard icon requirement:** all icons are inline SVG strokes (`stroke-width: 1.7`, `stroke-linecap: round`, `fill: none`). **Do not** mix Unicode symbols, emoji, or icon fonts. If 👛💳🔔⚙ or similar characters appear in a review, the build fails.

#### Active item: Balance

- A `3 px` wide, about `21 px` tall blue vertical bar on the far left of the sidebar
- The bar hugs the sidebar edge, radius `2 px`
- Wallet icon ground is a `28 × 28 px` blue rounded square
- Icon ground uses `--shadow-icon`
- Label stays dark; do not fill the whole row blue

#### Primary button: New order

- Position about `x=74, y=314`
- Size about `154 × 32 px`
- Background: `--blue-500`
- Radius: `9 px`
- Blue lift shadow: `--shadow-active`
- Content horizontally centered
- Icon-to-text gap `8 px`
- Text `11 px / 500 / white`

### 6.5 Promo card

Above the bottom of the sidebar, about:

- Coordinates: `74, 566`
- Size: `154 × 77 px`
- Background: `--surface-promo` (`#edeffb`, slightly grayer than `--surface-soft`)
- Radius: `11 px`
- Padding: `11 px`

Copy:

```text
Advanced mode
Coming soon

Join Waitlist  →
```

Hierarchy:

- Title: `10 px / 700 / dark`
- Caption: `8 px / 400 / dark gray`
- Link: `9 px / 600 / blue`

Place an about `32 × 32 px` white circle in the lower right with a yellow lightning bolt inside. The white ground may have an extremely light shadow.

### 6.6 Help

- Around `y=676`
- About `18 px` below the promo card
- Left: circular light-gray icon ground `24 × 24 px`
- Inside: question mark or Help Circle
- Label `Help`, `10 px / 500`
- Full row height `32 px`

---

## 7. Top balance card

### 7.1 Container

- Coordinates: `248, 67`
- Size: `714 × 196 px`
- White background
- Radius: `15 px`
- Padding: left/right `20 px`

The card has three horizontal bands:

1. Top tool strip: about `52 px`
2. Tab strip: about `32 px`
3. Balance and quick-actions band: remaining space

### 7.2 Top tool strip

#### Time on the left

Around `x=268, y=90`:

- A `12 px` clock icon first
- `5 px` gap to the text
- `13:34 PM`: `10 px / 600 / dark`
- `UTC+3`: `8 px / 400 / gray`
- About `3 px` between time and timezone

#### Account tools on the right

Right to left:

1. Settings gear
2. Notification bell with a blue dot at the upper right
3. Theme pill: sun + moon
4. Blue circular plus
5. Balance `$13,650.25`
6. Plan tag `Starter`

Vertical center of the whole group around `y=94`.

Spec:

- Icon-button hit target: `28 × 28 px`
- Bare icon visual size: `14–15 px`, **must be SVG stroke icons — no emoji**
- Gap between icon buttons: `8 px`
- Plus button: `20 × 20 px`, blue ground, white glyph, light blue shadow
- Current balance: `10 px / 600`
- Starter: about `55 × 18 px` pale-yellow pill, yellow dot on the left, type `8 px / 600`
- Theme pill: about `44 × 22 px`, background `#f0f1f5`; sun is active on a `#eaf0ff` circular ground (diameter `20 px`); moon is a gray stroke with no fill
- Bell notification dot: diameter `4 px`, upper-right of the icon, color `--blue-600`
- Tool-strip icons (settings / notification / clock) share a `#6f7481` stroke, width `1.7 px`

### 7.3 Tabs

Tabs start around `x=269, y=132`:

- `Balance`
- `Order payments`

Tab size `13 px`, gap between the two about `27 px`.

Active item:

- Blue text
- `font-weight: 600`
- `2 px` blue indicator line below
- Indicator width about `58 px`
- About `12 px` from the text baseline to the indicator

A `1 px` divider runs the full content width under the tab strip, color `--line`.

### 7.4 Balance figure

On the left around `x=268, y=180`:

- Label: `Your balance:`, `10 px / --text-secondary`
- Label-to-amount gap: `8 px`
- Integer: `$13,650`, `38 px / 600 / --text-strong`
- Decimal: `.25`, `20 px / 400 / --text-tertiary`
- Decimal sits flush after the integer, bottom-aligned on the same baseline

Do not add a currency icon, up/down arrows, or secondary metrics to the balance.

### 7.5 Quick-action cards

Three cards in a row on the right:

| Card | Approx. position | Size | Icon |
|---|---:|---:|---|
| By Card | `499, 176` | `141 × 68` | bank card |
| By Crypto | `650, 176` | `141 × 68` | Bitcoin |
| Invoice | `801, 176` | `141 × 68` | invoice |

Shared spec:

- Background: `--surface-soft`
- Radius: `13 px`
- Padding: `14 px`
- No border, no obvious shadow
- Icon at top-left, SVG about `21 × 21 px`, stroke `--blue-600`, **no emoji**
- Title at bottom-left, `10 px / 600 / blue`
- A `+` at the bottom-right (SVG or a thin character), visual size `18 px`, color `--blue-600`, `font-weight: 300`
- Card gap: `10 px`
- Inside the card use `position: relative`; icon `14 px` from top-left, title `14 px` from bottom-left, plus `10–12 px` from bottom-right

These cards are not primary buttons — do not fill them solid blue. Their visual weight must sit below New order. All three backgrounds must be `--surface-soft`; do not let one lean violet and another gray.

---

## 8. Lower payment-history card

### 8.1 Container

- Coordinates: `248, 272`
- Size: `474 × 429 px`
- Background: white
- Radius: `15 px`
- Padding: top `20 px`, left/right `19 px`
- Overflow clipped inside the card

### 8.2 Title row

- Title `Payment history`
- Around `x=268, y=299`
- `13 px / 700`

Right-side button:

- Label `Download`
- Size about `79 × 28 px`
- Pale-blue background
- Radius `8 px`
- Download icon `13 px` on the left
- Type `9 px / 600 / blue`
- Flush right, about `20 px` from the card edge

### 8.3 Table

Table starts around `y=341`. No outer frame. Columns:

| Column | Approx. start | Width | Align |
|---|---:|---:|---|
| Date | `268` | `84 px` | left |
| Payment method | `352` | `112 px` | left |
| Type | `464` | `76 px` | left |
| ID number | `540` | `80 px` | left |
| Amount | `620` | `81 px` | right |

Header:

- `9 px / 600 / --text-primary`
- Sortable columns have an up/down double chevron after the name
- Sort icon `7 px`, light gray
- Header height about `30 px`
- Bottom edge `1 px solid --line`

Rows:

- Row height about `41 px`
- `1 px` light-gray divider under each row
- Body `9 px`
- Date and ID use gray
- Payment method and amount use darker type
- Amount right-aligned, `font-weight: 600`
- Show a `+` prefix

Reference data:

| Date | Payment method | Type | ID number | Amount |
|---|---|---|---|---:|
| 25.02.2022 | Mastercard `*7436` | Debit | 38766940 | + $4,035.00 |
| 23.02.2022 | Visa `*9900` | Debit | 38766940 | + $1,222.00 |
| 20.02.2022 | Referal | Bonus | 38766940 | + $59.00 |
| 15.02.2022 | Visa `*2310` | Debit | 38766940 | + $3,035.00 |
| 12.02.2022 | Mastercard `*7436` | Debit | 38766940 | + $510.00 |
| 09.02.2022 | Visa `*9900` | Debit | 38766940 | + $2,195.00 |
| 05.02.2022 | Invoice | Invoice | 38766940 | + $953.00 |
| 03.02.2022 | Referal | Bonus | 38766940 | + $105.00 |

To match the recreation, the misspelling `Referal` in the reference may be kept as-is; a shipping product should use `Referral`.

### 8.4 Payment-method marks

Payment method is not a text pill. It is a small brand mark + last-four / name:

- Mastercard: `29 × 17 px` black rounded rect (`border-radius: 3px`), two overlapping circles inside: left `#eb001b`, right `#f79e1b`, diameter `8 px`, horizontally centered
- Visa: `29 × 17 px` background `linear-gradient(135deg, #1a1f71, #2b5fd9)`, radius `3 px`, white `VISA` at `6 px / 700`
- Referal: `20 × 20 px` background `#f1ecff`, radius `4 px`, inner violet `#633de8` four-point star or gift SVG `10 px`
- Invoice: `29 × 20 px` background `#3d4450`, radius `3 px`, inner white two-way arrow SVG `11 px`
- Icon-to-last-four gap: `5 px`
- Last-four color: `--text-secondary`

If brand logos cannot be used, draw simplified vector marks. Do not use colored emoji.

### 8.5 Type color

- Debit: orange type, leading `3 px` orange dot
- Bonus: violet type, leading violet dot
- Invoice: cyan type, leading cyan dot
- Size `9 px / 600`

### 8.6 Inner scrollbar

The reference has an extremely thin scrollbar inset on the right of the history card:

- Track may be transparent
- Thumb width `3 px`
- Thumb height about `72 px`
- Light gray-violet `#e7e8f1`
- Radius `99 px`
- About `5 px` from the card's right edge

Show 8 rows at the baseline; the last row may clip near the bottom to imply the list scrolls.

---

## 9. Statistics card

### 9.1 Container

- Coordinates: `730, 272`
- Size: `232 × 429 px`
- White background
- Radius: `15 px`
- Padding: `20 px`

### 9.2 Title and month switcher

Title:

- `Statistics`
- `13 px / 700`
- Left-aligned

Month control at the upper right:

```text
‹    April 2023    ›
```

- Left/right arrow icons: `9 px`
- Month: `8 px / 500`
- The three are vertically centered
- Left arrow dark, right arrow light gray — previous month is available, next is not

### 9.3 Donut geometry

The donut sits in the upper-center of the card:

- Chart bounding box about `178 × 178 px`
- Center about `x=846, y=430`
- Outer radius about `82 px`
- Stroke width about `14 px`
- Caps: round `stroke-linecap: round`
- Track: very light gray-violet
- Whole ring starts around `-82°`

Three segments by visual share:

| Data | Color | Visual share |
|---|---|---:|
| Debit | orange `#ff6b1a` | `53%` |
| Invoice | cyan `#15b8ed` | `29%` |
| Bonus | violet `#633de8` | `18%` |

Visual order in the reference:

- Orange takes a large arc from upper-left through left to lower-left
- Cyan runs from upper-right down to lower-right
- Violet sits lower-right
- No obvious white gaps between segments; round caps join them naturally

**Visibly** soft colored glows sit below and to the lower-right of the ring (not optional decoration — missing them clearly misses the reference):

- Orange glow: under the orange arc, lower-left; color `#ff6b1a`; blur `22 px`; opacity `14%`
- Cyan glow: under the cyan arc, lower-right; color `#15b8ed`; blur `20 px`; opacity `12%`
- Violet glow: under the violet arc, lower-right; color `#633de8`; blur `18 px`; opacity `10%`
- Glow layer offset down `10–14 px`; must not bleed into the title

Most reliable implementation:

1. One SVG layer draws the real ring;
2. Duplicate the same-colored ring, offset down `12 px`;
3. Apply `filter: blur(18px)` and low opacity to the duplicate;
4. Clip the container so the shadow cannot pollute the title.

### 9.4 Chart center

Center content stacks vertically:

```text
$22,123
Total expenses per
month
```

- Total: `27 px / 700 / --text-strong`
- Caption: `8 px / 400 / --text-secondary`
- Total-to-caption gap: `5 px`
- Text horizontally centered

### 9.5 Floating tooltip

The reference floats a black tooltip on the upper-left of the ring, slightly toward center:

```text
• Debit  $1,222.00
```

- About `88 × 23 px`
- Black / deep charcoal background
- Radius `8 px`
- Shadow `--shadow-tooltip`
- Type `8 px`
- Debit dot and label are orange
- Amount is white
- The tooltip may overlap the ring and the edge of the center figure

In a static recreation, show this tooltip by default. In an interactive build, show it on hover of the Debit segment.

### 9.6 Legend

Legend sits under the chart in two rows:

First row:

- Debit `$1,222.00`
- Bonus `$243.00`

Second row, centered:

- Invoice `$1,765.00`

Each legend item:

- Height about `22 px`
- Horizontal padding `9 px`
- Pill radius
- Type `8 px`
- Category-colored dot on the left
- Label uses the category color
- Amount uses dark gray

Grounds (observed):

- Debit: `#f4eae1` (peach, not pure white)
- Bonus: `#f1ecff` (pale violet)
- Invoice: `#eef6ff` (pale cyan-blue)

Item gap about `7 px`, row gap about `7 px`.

---

## 10. Icon language

All icons must come from **one set of inline SVG stroke icons**. This is a make-or-break constraint for the recreation:

- Stroke width: `1.7 px` (fixed — do not mix 1.5 and 2.0)
- Caps and joins: `round`
- Default viewBox: `0 0 24 24`, rendered `14–16 px`
- Nav icons render `14 px` inside their container
- Quick-action card SVGs render `21 px`
- **Forbidden:** emoji, Unicode pictographs (⌂▦◷👛💳₿📃🔔⚙☀☾⚡), mixed icon fonts, photorealistic PNG icons
- Allowed: simplified payment-brand SVGs (MC / Visa), logo-specific SVGs

Minimum SVG template:

```html
<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <!-- path -->
</svg>
```

Suggested icon meanings:

```text
Home, Grid, PieChart, Wallet, Receipt, FilePlus,
HelpCircle, Clock, Sun, Moon, Bell, Settings,
CreditCard, Bitcoin, FileText, Plus, Download,
ChevronLeft, ChevronRight, ChevronsUpDown
```

Bank-card, Visa, and Mastercard marks are payment-method brand marks. See §8.4 for their own construction; they do not use the generic stroke template.

**Lightning icon (promo card):** a `#ffd735` filled SVG bolt inside a `32 × 32 px` white circle; no ⚡ emoji.

---

## 11. Interaction and states

The reference is a still, but a recreation must at least define the following states.

### 11.1 Nav

- Hover: icon ground or the whole row takes `--surface-blue`
- Active: Balance pattern — left bar + blue icon ground
- New order hover: translate up `-1 px`, shadow slightly stronger
- Focus: `2 px` blue outline, offset `2 px`

### 11.2 Tabs

- Click swaps the active label and the bottom indicator
- Indicator may slide with `160–200 ms ease-out`
- Inactive hover darkens the type; do not add a pill background

### 11.3 Quick actions

- Hover: background deepens from `--surface-soft` to `--surface-blue`
- The whole card is clickable
- The plus may rotate or scale, but motion must not exceed `160 ms`

### 11.4 Table

- Row hover: `rgba(49, 91, 245, 0.025)`
- Header sort click highlights only the matching chevron
- Download hover: ground slightly darker
- A sticky header on scroll is not required; if you add one, it must not change the baseline still

### 11.5 Donut

- Hovering a segment moves it radially out `2 px` or increases stroke by `1 px`
- Tooltip follows the hovered segment
- First-entry animation: the ring draws in over `500–700 ms`
- Honor `prefers-reduced-motion`

---

## 12. Layout implementation notes

### 12.1 Top-level grid

```css
*, *::before, *::after {
  box-sizing: border-box;
}

.app-shell {
  display: grid;
  grid-template-columns: 178px 1fr;
  gap: 8px;
  width: 922px;
  height: 656px;
  padding: 11px;
}

.workspace {
  display: grid;
  grid-template-rows: 196px 429px;
  gap: 9px;
}

.workspace-lower {
  display: grid;
  grid-template-columns: 474px 232px;
  gap: 8px;
}
```

### 12.2 Top card

Do not absolutely position the top balance card. Use:

- Toolbar above: flex, space-between
- Tabs in the middle: flex + bottom divider
- Content below: grid — left balance fixed about `211 px`, three cards equal on the right

```css
grid-template-columns: 211px repeat(3, 1fr);
gap: 10px;
```

### 12.3 Statistics chart

Use SVG, not a CSS `conic-gradient`, because:

- SVG makes round caps easier;
- segment length and start angle are more controllable;
- tooltip anchors are more stable;
- shadows can duplicate the path and blur independently.

---

## 13. Responsiveness and scale

This is a desktop-app composition. Do not restack into mobile cards on a narrow screen.

### 13.1 Recommended breakpoints

| Viewport | Behavior |
|---|---|
| `≥ 1024 × 720` | native size or near-native |
| `900–1023 px` wide | scale the whole shell proportionally |
| `< 900 px` wide | keep scaling; allow page scroll; do not reflow |

### 13.2 High-resolution viewports

At `1440 × 900` or larger:

- Prefer a max app-window width of about `1080–1160 px` and scale internals with it;
- or keep `922 × 656 px` and let outer whitespace grow;
- do not stretch only the workspace — that distorts the table-to-stats ratio.

If you choose fluid scale, keep:

```text
sidebar : workspace = 178 : 714
history card : stats card = 474 : 232
top-card height : lower-card height = 196 : 429
```

---

## 14. Accessibility constraints

High fidelity must not cost usability:

- Every icon-only button has an `aria-label`
- Click targets are at least `28 × 28 px`; the visual glyph may be smaller than the hit box
- Blue links and buttons keep at least `4.5:1` contrast against their ground
- The table uses real `<table>` semantics
- Tabs use `role="tablist"`, `role="tab"`, and `aria-selected`
- The donut has a text summary; do not rely on color alone
- Debit / Bonus / Invoice use both a text label and a color dot
- Keyboard focus must not be clipped by `overflow: hidden`

Some `8–9 px` micro type in the reference is a poor long-term product size. If usability wins, bump those sizes by `1 px`, but also bump line-height so composition does not break.

---

## 15. Assets and copy inventory

Assets needed for the recreation:

1. ProMobile vector wordmark
2. One unified linear icon set
3. Simplified Mastercard mark
4. Simplified Visa mark
5. Referal violet mark
6. Invoice dark mark

Page copy:

```text
PRO MOBILE
Overview
My Apps
App Overview
Balance
My Orders
New order
Advanced mode
Coming soon
Join Waitlist
Help

13:34 PM
UTC+3
Starter
$13,650.25
Balance
Order payments
Your balance:
By Card
By Crypto
Invoice

Payment history
Download
Date
Payment method
Type
ID number
Amount

Statistics
April 2023
$22,123
Total expenses per month
Debit
Bonus
Invoice
```

---

## 16. Implementation order

To cut visual rework, implement in this order:

1. Page background, app shell, and two-column grid
2. Size, gap, and radius of the three main cards
3. Sidebar structure and nav active state
4. Top tool strip, tabs, and balance area
5. Three quick-action cards
6. Table column widths, row height, and payment marks
7. Stats-card SVG ring, center copy, and legend
8. Type, color, shadow, and micro alignment
9. Hover, focus, scroll, and tooltip
10. Screenshot at `1024 × 768` and overlay-check

Do not start with animation or live data. Unstable layout sizes will fight visual calibration.

---

## 17. High-fidelity acceptance checklist

### 17.1 Overall

- [ ] In a `1024 × 768` screenshot, the app window sits around `51,56` at about `922 × 656`
- [ ] Even light blue-gray margin around the window, with a soft drop shadow
- [ ] Sidebar, top card, history card, and stats card edges are within `4 px` of baseline
- [ ] No traditional top bar, browser-style chrome, or hard dividing rules

### 17.2 Sidebar

- [ ] Logo is top-left and stays two-tone blue/black
- [ ] Six nav items are compact, with even vertical rhythm
- [ ] Balance has the left blue bar and a blue wallet-icon ground
- [ ] New order is the only large solid-blue nav button
- [ ] Promo card and Help are anchored to the bottom

### 17.3 Top card

- [ ] Tool strip: time on the left; plan, balance, plus, theme, notification, settings on the right
- [ ] Balance tab uses blue type and a thin blue underline
- [ ] `$13,650` is the largest type on the page; the decimal is clearly smaller and lighter
- [ ] Three quick-action cards are the same size; icon top-left, plus bottom-right

### 17.4 History card

- [ ] Fixed column widths; amount column right-aligned
- [ ] Rows use only a very light divider
- [ ] Mastercard, Visa, Referal, and Invoice have distinct marks
- [ ] Debit, Bonus, Invoice use orange, violet, cyan
- [ ] A thin scrollbar appears on the inner right of the card

### 17.5 Statistics card

- [ ] Ring is horizontally centered in the card; outer diameter about `164 px`
- [ ] Orange is the largest segment, cyan second, violet smallest
- [ ] Round caps, with restrained colored under-glows
- [ ] Center `$22,123` is clear; caption wraps to two lines
- [ ] Black Debit tooltip is visible by default
- [ ] Legend is two-up then one-centered pills

### 17.6 Material

- [ ] White cards separate from the gray-violet shell by luminance, not heavy shadow
- [ ] Accent is always royal blue; orange / cyan / violet are data-only
- [ ] Icon stroke width is unified; no emoji or mixed styles
- [ ] Radii follow the `22 / 15 / 13 / 9 / pill` ladder
- [ ] Type hierarchy comes from size, weight, and gray — not extra colors

---

## 18. Design traits that must not drift

These changes clearly break the reference. Avoid them in implementation:

- Dark or frosted-glass sidebar
- A top bar spanning the full window
- Purple gradients as the brand look
- Thick borders or heavy shadows on every card
- Large pill tab switchers
- Three solid-blue quick-action buttons
- A high-density enterprise back-office table
- Sharp charts, square-capped rings, or complex charts with axes
- Folding, stacking, or hiding the stats card at the baseline desktop width
- Large illustrations, photo backgrounds, or extra decoration

A successful recreation is not about one logo or one data set. It is: **a large-radius desktop shell, an independent white sidebar, a full-width top card over a split lower grid, compact financial data, a royal-blue accent, and a low-contrast, softly floating hierarchy.**

---

## 19. Visual-check log (2026-07-29)

### 19.1 Method

1. Generate static HTML strictly from this document: `.design-check/promobile-from-design.html`
2. Screenshot at `1024 × 768`: `.design-check/generated-from-design.png`
3. Side-by-side with the reference `.design-check/reference.png` — layout, color, icons, chart

### 19.2 Passed

| Item | Reference | Generated from DESIGN.md | Result |
|---|---:|---:|---|
| Viewport | `1024 × 768` | `1024 × 768` | match |
| App-window position | `51, 56` | `51, 56` | match |
| App-window size | `922 × 656` | `922, 656` | match |
| Sidebar / workspace ratio | `178 : 714` | `178 : 714` | match |
| Lower-card ratio | `474 : 232` | `474 : 232` | match |
| Main structure (sidebar + top card + lower-left table + lower-right chart) | four regions | four regions | match |
| Accent blue | near `#3f61ff` | `#3e5cf8` | close enough |
| White cards / light ground hierarchy | low contrast | low contrast | match |

### 19.3 First-pass gaps and root causes

| Gap | Severity | Cause | Doc fix |
|---|---|---|---|
| Nav / toolbar / quick actions used emoji instead of icons | **High** | §10 forbids emoji but lacked an executable SVG spec | tightened §10, §6.4, §7.2 |
| Logo O was not a brand ring | Medium | §6.2 was too abstract | added SVG construction |
| Shell ground too gray `#f5f4f9` | Medium | first-pass token sampling | changed to `#f7f6fb` |
| Page background too dark `#e7f1f5` | Low | same | changed to `#e1ecf0` |
| Nav icon grounds inconsistent | Medium | only “pale blue / pale cyan”, no numbers | added nav-bg tokens |
| Donut color glows almost invisible | Medium | §9.3 “8–12%” too weak | raised to 10–14% and marked required |
| Legend pills too white | Low | no observed color | added `#f4eae1` etc. |
| Promo-card ground | Low | shared token with action cards | added `--surface-promo` |
| MC / Visa marks oversimplified | Medium | §8.4 underspecified | added gradient / dual-circle construction |

### 19.4 Re-check bar

After updating the document, generate the screenshot again. These must look close to the reference by eye, or keep revising the spec:

1. No emoji characters on the page
2. All six sidebar icons are “pastel ground + stroke icon”; Balance is blue ground, white icon
3. Shell gutter shows `#f7f6fb` pale violet-gray, not a darker gray
4. Orange / cyan / violet glows are visible under the ring
5. Legend pills have tinted grounds, not white-on-black
6. Tooltip is `#191b20` dark ground, orange dot + white amount

### 19.5 Artifact paths

```text
.design-check/
  reference.png              # copy of the reference
  promobile-from-design.html # static page generated from DESIGN.md
  generated-from-design.png  # 1024×768 generated screenshot
```

Implementers should repeat §19.1 after any substantial change to DESIGN.md.
