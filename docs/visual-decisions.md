# Visual Decisions

Status: RESOLVED = implement as written. OPEN = needs owner input; do not guess.
Where an OPEN item blocks nothing, use a clearly marked placeholder and continue.

Related: SRS v0.5 (FR-107, FR-109, NFR-015), Design Decisions (Phase 1).

## Game look

Dark fantasy RPG, direction "Soulfire Relics": luminous magical energy against
cold, weathered surroundings. Hand-drawn pixel art made by the owner (not
AI-generated). The UI is information-dense (levels, proficiency, knowledge,
skill points, cores, rings, mana, combat state). Numbers are the content, not
decoration.

## Decisions

| # | Topic | Decision | Status |
|---|---|---|---|
| A1 | Design tokens | All visual values live in CSS custom properties in one tokens file (colors, spacing scale, borders, type sizes, pixel scale). Agents use only these tokens and never invent hex codes, spacing values, or fonts. If a needed token is missing, the agent adds it as a clearly marked placeholder (comment `PLACEHOLDER`), keeps working, and lists every new token in its report. Agents do not stop and wait. | RESOLVED |
| A2 | Pixel-art rendering | PNG only, no anti-aliasing, no resampling. All pixel-art images use `image-rendering: pixelated` and are sized in whole multiples of their native size. No fractional scaling. | RESOLVED |
| A3 | Global pixel scale | Every art pixel is the same size on screen across the whole game. Native grids may differ between assets (icons vs bosses); the display scale may not. Stored as one variable (`--px-scale`), a single edit to change. Integer scales can render unevenly at some OS display scales (125% and 150% are common on Windows laptops), so the chosen scale must be tested before it is committed (see A4). | RESOLVED |
| A4 | Scale and icon grid values | Provisional: item icons 48x48 native. Leading pixel scale is 2x (clean at 100% and 150% OS display scaling, uneven at 125%). 3x is adopted only if a real mockup shows a meaningful advantage; it is clean only at 100%. Both are config values. Decision follows a dense-stat-row test at both scales, run at 100%, 125%, and 150% OS scaling and at several browser zoom levels, since CSS layout and image positioning can also cause uneven pixels. | OPEN (provisional values usable) |
| A5 | Palette | Foundation tokens: Void #10151A, Panel #1A2228, Raised #242D32, Stone #39464A, Border #566166, Text #D7D0B8, Muted #929B9A, Disabled #626C70. Accents: Gold #FFC857 (single shared gold; #E9B957 is dropped), Ember #FF794F, Blood #D94752, Soulfire #5BE0C2, Wisp #A8F078, Aether #69C9FF, Eldritch #C58AFF. Identity colors outside this list: Cyan #55D6E8 (Knowledge), Soul Magenta #ED75B8 (Proficiency). Vermilion #FF6257 is dropped. The palette is split into a UI token set (mid-tones) and a larger art palette (see A22) that includes the tokens as a subset. | RESOLVED (visual validation pending, see A18) |
| A6 | Pixel font | Not chosen. Choose after testing real gameplay numbers: legible digits, compact widths, fits the pixel art. Avoid very wide fonts in dense stat rows. Font size derives from --px-scale and must be an integer multiple of the font's design height. Check the license before committing. Until then, use one neutral fallback and do not mix in others. | OPEN |
| A7 | Panels and buttons | Use `border-image` with a small 9-slice pixel frame drawn by the owner. No CSS gradients, soft shadows, or rounded glassmorphism. Placeholder frames are plain flat borders until the art exists. | RESOLVED |
| A8 | Progression identities | Level = Gold #FFC857 + "Lv" label. Proficiency = Soul Magenta #ED75B8 + glyph. Knowledge = Cyan #55D6E8 + book/eye glyph. Skill points = Text cream #D7D0B8 + star glyph. Each identity pairs its color with its glyph or label (A15). (Supports NFR-015.) | RESOLVED |
| A9 | Mana display | Cores are solid filled shapes. Rings are outlined shapes. Equipment-granted rings must look visibly distinct from core-derived rings, since they are removable. (Supports FR-109.) | RESOLVED |
| A10 | Requirement states | Locked = slate + padlock. Affordable = cream frame + "+" marker (not a hue). Owned = gold + check marker. Requirement unmet = Blood + X or "!" marker. State must never rely on color alone. Unmet-requirement text uses Muted, not Disabled or Blood. Blood on a requirement is glyph and frame only, never a bar fill. (Supports FR-107.) | RESOLVED |
| A11 | Skill branches | Destruction = Ember. Nature = Wisp. Arcana = Aether #69C9FF, shape-led (unique node silhouette and icon). Void = Eldritch #C58AFF. Each branch has its own node shape, so branch is readable without color. Arcana and Knowledge are close in hue and must be validated side by side. Test with mixed branches visible, not one branch at a time (cross-specialization). | RESOLVED (validation pending) |
| A12 | Icon references | Item data stores an icon id string only (for example `icon: "sword-iron"`). Data and core code never import image files. A UI-side registry in `src/ui` maps icon ids to imported PNGs. Reason: `src/data` must stay runnable under tsx so `scripts/sim.ts`, the balance tool, and tests do not crash on `.png` imports, and the asset pipeline must not leak into content that core types depend on. A missing registry entry falls back to a placeholder icon and is reported, not thrown. No sprite sheets for now. | RESOLVED |
| A13 | Placeholder-first | Phase 1 art is 1 stage, 3 enemy types, 1 boss, and minimal UI pieces. Use rough placeholders at the final scale. Do not request or wait for polished art before layouts are validated. | RESOLVED |
| A14 | Native sizes by asset type | Provisional placeholders: resource/stat glyphs 8x8 (minimum for any A15 marker, see A16), item icons 48x48, enemy sprites 32x32, boss sprite 64x64. Enemy 32x32 is a temporary placeholder only; 48x48 is the leading candidate. Test a 64x64 and a 96x96 boss against the arena before settling. All are config values. Mark provisional sizes in code. | OPEN (provisional values usable) |
| A15 | Meaning-carrying color rule | Any color that carries gameplay meaning requires a mandatory glyph or label. Plain text never uses a meaning-carrying treatment. Cream: star = skill points, "+" frame = affordable, bare = ordinary text. Gold: "Lv" = level, check = owned. Glyphs must stay legible at the smallest supported scale. | RESOLVED |
| A16 | Minimum glyph grid | Any icon carrying a marker from A15 uses at least an 8x8 native grid. Test at the chosen --px-scale and at 100%, 125%, and 150% display scaling. | RESOLVED |
| A17 | Contrast | Verify text and marker contrast with a checker, not by eye. Target 4.5:1 for small text. Known risks: Blood and Disabled on Panel/Raised. | RESOLVED |
| A18 | Palette validation task | One mockup sheet at the real pixel scale with 8x8 placeholder glyphs: Knowledge vs Arcana, Knowledge vs Soulfire, Proficiency vs Void, Wisp in Nature and player-HP contexts, and player vs enemy HP bars checked under protanopia, deuteranopia, and tritanopia (Chrome DevTools vision emulation). Failures are reported with alternatives. Agents do not change colors. Does not block implementation. Currently deferred by the owner. | OPEN (deferred) |
| A19 | Combat and bar colors | Player HP = Wisp. Enemy HP = Blood. Boss HP = Blood, larger bar with a distinct frame (no new color). Mana = Soulfire. XP = Gold, labeled with "Lv". Damage dealt = cream (untinted). Crits = Gold + larger text + "!" suffix (no star; star is reserved for skill points). Damage taken = Blood. Heals = Wisp + "+" prefix. Burn ticks = Ember. Numbers printed on bars are cream with a dark outline, never tinted. Player and enemy bars are told apart by label, placement, and visible numeric values, not color alone (see A20). | RESOLVED |
| A20 | Colorblind and contrast validation | Green player HP vs red enemy HP is a known colorblind failure case, and Wisp's lightness difference from Blood is not the primary safeguard. Player and enemy bars need distinct treatments (frame or fill pattern) and small player/enemy indicators in addition to labels, placement, and numbers. Validate with color-vision-deficiency simulations (deuteranopia, protanopia, tritanopia) and a contrast checker (A17). Failures are reported with alternatives; agents do not change colors. Validation is a task, not a blocker. | RESOLVED (validation pending) |
| A21 | Color roles by context | Branch colors (A11) are used for node fills, node shapes, and branch tinting on the skill tree. Identity colors (A8) are used only as glyph plus value, never as fills, frames, or tints. On the skill tree, unmet requirements use the A10 state treatment, with the identity glyph and value in Muted; the identity color appears only once a requirement is satisfied. If Proficiency and Void still blur in the A18 test, change the Proficiency glyph shape or outline first; changing the color is a last resort. | RESOLVED |
| A22 | Art palette | Proposed ramps (shadow / base / highlight): Fire #8C2F2B / #FF794F / #FFC2A0. Gold #7A4A1E / #FFC857 / #FFEFB0. Soulfire #1B6A6E / #5BE0C2 / #C6FBE6. Brown #3B2A22 / #6B4A33 / #9A6E47. Proposed sprite outline #0B0809. All values await owner approval and are not final. The outline must be tested against real arena backgrounds, since hex values alone cannot show whether it separates enough. Combat backgrounds use Panel or lighter so outlines read. The UI token set stays compact; art may use ramps beyond it. Ramps for other accents are added on demand. | OPEN |

## Style rules for agents

- Avoid the generic AI look: purple-blue gradients, soft card shadows, large
  rounded cards with one stat each, emoji as icons, uniform generous padding.
- Prefer compact stat rows and tight spacing from the spacing scale.
- Do not make aesthetic decisions beyond these tokens. If a screen needs a new
  treatment, propose it in the report and use a marked placeholder meanwhile.
- Report any layout that breaks at the chosen pixel scale instead of silently
  working around it.
- Never change a color to solve a collision. Report it with alternatives.
- Treat OPEN (provisional values usable) items as working defaults, and keep
  every provisional value in config so changing it is a single edit.

## Needed from the owner (none of this blocks work)

1. Approval of the art ramps and sprite outline (A22), after a real-background
   test of the outline.
2. Pixel scale and icon grid decision (A4), after the dense-stat-row test at
   100/125/150% OS scaling and several browser zoom levels.
3. Final native sizes for enemy sprites and boss (A14).
4. Font name or file (A6), after testing real gameplay numbers.
5. Mockup validation results for the A18 pairs and the A20 colorblind
   simulations (deferred for now).
