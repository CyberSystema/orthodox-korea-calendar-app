# Tablet redesign — the verified brief

Gilded is held off tablets (see `IS_TABLET` in `src/theme/direction.ts`); a tablet
renders Elegant until the composition below is finished. This file is the work
list for lifting that gate, and every number in it was **measured on an iPad Pro
13" against an iPhone 17 running the same build**, then put to an adversarial
verifier that was told to refute it. 41 findings were raised; the 31 below
survived. Ten did not and are deliberately absent.

## The one insight to start from

`useLeaf` exposes three scales. Two are used. **`ks` — the SPACE scale — is
computed and referenced nowhere.** So on a tablet the figures grow ~1.88x while
every gap stays within 2pt of the phone's, which is the single mechanism behind
the crowding at the top, the 364.5pt of dead page at the foot, and the halo
overrunning the navigator. Wiring `ks` through the vertical rhythm is the first
move, not a later polish step.

A second structural gap: **the headpiece is entirely outside the leaf**. Its
height, title, knots and closing rule are phone constants, so the band _shrinks_
in proportion as the device grows — 6.6% of a tablet window against 13.9% of a
phone's.

## Rules any fix must keep

- **The phone must not change.** Express every fix through the leaf (`k`, `kt`,
  `ks`, `width`, `spread`) or through the `smoothstep(w, 440, 620)` ramp, which is
  exactly 0 at every phone width by construction. Never `Platform.isPad`, never a
  new global constant.
- `StyleSheet.create` runs at import; anything depending on window size is an
  inline style.
- Text goes through `ScaledText`. The six liturgical marks are content.
- The app is portrait-only on every device.

## The top chrome — band, crown, ornaments

### `blocking` CORRECTION + UNMEASURED CONSEQUENCE of the known crown bug: the action pills fall to 2.05:1 — worse than the 3.20:1 regression the code comment claims to have fixed

**Where** `src/components/common/IlluminatedGround.tsx`:55

**Measured** Cause confirmed, magnitudes in the brief are wrong. MEASURED band bottom edge (wine→page step, sampled at x=1.5% of width): iPad 92.00pt, iPhone 122.00pt — the iPad band is 92pt, not the ~110pt stated. Crown fade ends at 0.15 x windowHeight = 206.4pt (iPad) / 131.1pt (iPhone), so the VISIBLE wash below the band is 114.4pt on iPad (not ~96pt) and 9.1pt on iPhone. Ground colour sampled at the right margin, iPad: y=93pt (141,111,101), y=104pt (149,122,111), y=122pt (165,140,129), reaching bare page only at y=206pt. iPhone: y=123pt (226,216,200), already page (237,229,212) by y=134pt. THE CONSEQUENCE NOBODY MEASURED — the action-pill row sits at y=104..130pt on iPad. Darkest pill glyph measured (109,88,28) = exactly token accentText #6D581C, on ground (161,135,124): contrast 2.05:1. Same token, same pill, iPhone: ground (237,229,212) → 5.47:1. On a bare page it is 5.63:1. WCAG AA normal text is 4.5:1; large-text AA is 3:1 — 2.05:1 fails both, and the comment at IlluminatedGround.tsx:50-54 says locations[1] was moved from 0.22 to 0.15 precisely because the pills 'measured 3.20:1'. That fix holds only at phone aspect; on iPad the shipped 0.15 is worse than the bug it replaced.

**Cause** locations[1] is a fraction of WINDOW HEIGHT while the thing it must finish under — the headpiece — is `topInset + 60`, a constant plus a device inset. The two are unrelated. On a 874pt phone 0.15 lands 9.1pt below a 122pt band (invisible); on a 1376pt iPad it lands 114.4pt below a 92pt band, and at the band's own bottom edge the crown is still only 44.6% faded — arithmetic confirmed: 92/206.4 = 0.446, and 58+0.446·(240−58) = 139 vs measured R=141.

**Fix** Mechanism and phone-safety are correct — keep the expression. One change: do not re-derive the band height in a second place. The proposed useHeadpieceHeight() = `insets.top + spacing.sm + 34 + spacing.sm + 10` duplicates IlluminatedHeader's own paddings (band paddingTop = topInset + spacing.sm, row height 34 + row paddingBottom spacing.sm, band paddingBottom 10), so any later tweak to the band silently desynchronises the crown from it — which is the exact class of bug being fixed. Instead export ONE constant from IlluminatedHeader and consume it in both places: `export const HEADPIECE_CHROME = spacing.sm + 34 + spacing.sm + 10; // 60` , have the band's styles derive its paddings from it, and `export const useHeadpieceHeight = () => useSafeAreaInsets().top + HEADPIECE_CHROME;`. Verified against the screenshots: 62 + 60 = 122pt (iPhone, measured 122.0) and 32 + 60 = 92pt (iPad, measured 92.0). Then in IlluminatedGround: `const { page } = useLeaf(); const { height } = useWindowDimensions(); const band = useHeadpieceHeight();` and `locations={[0, 0.15 + ((band + 9) / height - 0.15) * page, 0.72, 1]}`. iPad: (92+9)/1376 = 0.0734 -> wash ends at 101pt, 9pt below the band, reproducing the phone's own 9.1pt overhang in character rather than in absolute size. Pill contrast returns to 5.47:1 (I measure 5.47, not the claimed 5.63). Guard the ordering invariant while you are there: locations must stay non-decreasing, and (band+9)/height is ~0.07-0.15 on every portrait window this app can present, so it never approaches locations[2] = 0.72 — but a Math.min(..., 0.4) costs nothing and is multiplied by ramp=0 on phones anyway. Also fix the now-false comment on lines 49-54: it justifies 0.15 with a contrast measurement that only holds at phone aspect, and its '3.20:1' for #6D581C on #CABAAC actually computes to 3.63:1. Finally, note the fix is inert for the crown={false} callers (Settings, Staff, Diagnostics, the detail screens) since colors[0] === colors[1] === background there — no visual change on those screens on any device.

**Phone stays identical because** `page` is `smoothstep(wr, 440, 620)`, whose clamp makes it exactly 0.0 for any wr ≤ 440pt — wider than every supported phone. The interpolation therefore evaluates to the literal 0.15 already shipping, bit for bit, on every phone and every Android handset. No new constant, no Platform check; the guarantee is the same arithmetic one that makes k === 1.

### `major` The headpiece is the one surface on the leaf that never consumes the leaf: its drawn height is a fixed 60pt, so the iPad band is 30pt SHORTER than the phone's on a page 2.6x wider

**Where** `src/components/common/IlluminatedHeader.tsx`:99

**Measured** Icon-button top edge measured at exactly y=40.00pt (iPad) and y=70.00pt (iPhone) → `topInset + spacing.sm` gives insets.top = 32pt (iPad) / 62pt (iPhone). Band bottom measured 92.00pt / 122.00pt. Both satisfy `topInset + 8 + 34 + 8 + 10` exactly, so the band's OWN drawn height — everything below the status bar — is 60.00pt on BOTH devices, and the entire 30pt difference is the status-bar inset. As a fraction of the window the band is 122/874 = 13.96% on the phone and 92/1376 = 6.69% on the iPad — 48% of the phone's presence. Meanwhile the hero directly beneath it is drawn at k ≈ 1.87 (useLeaf on 1032x1376: gutter 41.28, width 949.44, usable 1084, pageHalo 433.6, k = 433.6/232 = 1.869, kt = 1.243, ks = 1.524). Corroborated in pixels: the day panel's OrnamentalRule lozenge measures 22.0pt tall on iPad vs 12.0pt on iPhone (ratio 1.83, within the 0.5pt quantisation of a 2x capture). So the page below the band grew 1.87x and the band shrank 0.75x.

**Cause** IlluminatedHeader never calls useLeaf. Every metric that sets its height is a literal frozen in `createStyles` (band paddingBottom 10 at line 179; row paddingBottom spacing.sm and paddingHorizontal spacing.md at 199-200; slot width 36 at 202; iconButton 34x34 at 222-223) or a literal at the one inline site (line 99, `topInset + spacing.sm`). StyleSheet.create runs at import, so none of them could depend on window size even if they wanted to.

**Fix** Keep the reviewer's box work, fix its rationale, and add the four things it leaves at phone size. All of it goes INLINE — not because StyleSheet.create is import-time (it is not here; useThemedStyles resolves per render) but because useTheme.ts:94 states the contract explicitly: "The factory must be a pure function of the theme — anything else (font scale, insets, window size) belongs in an inline style."

In IlluminatedHeader: `const { k, kt, ks } = useLeaf();`

1. BOX (as proposed, correct). Line 99: `{ paddingTop: topInset + spacing.sm * ks, paddingBottom: 10 * ks }` — the inline wins over styles.band without deleting line 179, so that deletion is optional. Line 121 row: `{ paddingHorizontal: spacing.md * ks, paddingBottom: spacing.sm * ks, gap: spacing.sm * ks }`. Slots 122/140: `{ width: 36 * kt }`.

2. TITLE — the omission that matters most. Line 133: `style={[styles.brand, { fontSize: 13 * kt, letterSpacing: 3.4 * kt }]}`. letterSpacing MUST scale with the size or the tracking-to-size ratio drifts and the widely-letterspaced caps stop being the typographic move the file's own comment calls "the one typographic move that most separates a manuscript band from an app bar". Result 16.2pt / 4.23. No truncation risk: the title measures 212.5pt drawn, so at kt it needs ~264pt inside a centre slot of ~890pt.

3. KNOTS. Lines 125/137: `size={13 * kt}`, NOT k. The doc's letter puts ornament in FIGURE (k), but these two knots are sized 13 to match the title's 13 — they flank it. At k=1.87 they become 24.3pt beside a 16.2pt title and dominate it; kt keeps the pairing the phone has.

4. CLOSING RULE. Line 146: `<OrnamentalRule width={width} color={th.accentBright} scale={kt} />`. Geometry check, since the rule is absolutely positioned at `bottom: -2` inside an `overflow: hidden` band: the lozenge's top sits `13*scale - 2` above the band's bottom edge. At scale=kt that is 14.2pt against a 15.24pt paddingBottom — clean, and it preserves the phone's near-flush relationship (11pt vs 10pt). scale={k} would be the doc-literal FIGURE reading and matches IlluminatedDay's call, and it does still clear the button (22.3pt vs 27.4pt of combined padding), but it eats the band's whole bottom padding; use it only if the owner wants the heavier rule, and then raise paddingBottom to ~13*k − 2 = 22.3.

5. ICON GLYPHS. A 19pt glyph in a 42.3pt button looks lost. HeadpieceButton calls `useLeaf()` for its own box: `{ width: 34 * kt, height: 34 * kt, borderRadius: radii.sm * kt }`. The glyph size is passed by the caller, so the three call sites — TodayScreen.tsx:375,380, MonthScreen.tsx:539,544, AnnouncementsScreen — each add `const { kt } = useLeaf();` and pass `size={19 * kt}`. (Leave the non-gilded fallback paths at 20 and the native-header paths at 22 alone; they are different branches.) A render-prop `icon={(size) => ...}` on HeadpieceButton is the tidier API if you would rather not touch three screens.

DROP FROM THE WRITE-UP: the 44pt touch-target justification. `hitSlop={8}` already gives both devices a 50x50pt target, so there is no accessibility defect to claim, and 42.26pt would not reach 44 regardless. The defect is compositional, not tappability.

PHONE PROOF for every added line: kt === 1 and ks === 1 exactly at all phone widths, so 13*kt=13, 3.4*kt=3.4, 19*kt=19, 36*kt=36, 34*kt=34, radii.sm*kt=4, 8*ks=8, 10*ks=10, 12*ks=12, and scale={kt} equals OrnamentalRule's existing `scale = 1` default. Byte-identical.

SEQUENCING NOTE: this interacts with the already-diagnosed IlluminatedGround crown. Taking the band from 92.0 to 113.9pt shrinks the wine-over-page smear from ~96pt to ~92pt but does not fix it — the crown must still be tied to the band's height. Land the band fix first so the crown has a stable height to key off.

**Phone stays identical because** k === 1 exactly at every phone width (ramp = smoothstep(wr,440,620) = 0 below 440pt → halo === phoneHalo → k = phoneHalo/phoneHalo = 1). kt = min(1 + (k−1)·0.28, 1.36) = 1 exactly, and ks = Math.sqrt(1·1) = 1 exactly in IEEE754. Every rewritten expression therefore evaluates to the identical literal: 8·1=8, 34·1=34, 10·1=10, 36·1=36, 12·1=12. Band height stays 122pt on the measured iPhone and whatever `topInset + 60` is on any other phone or Android device — unchanged.

### `major` The band's lettering and knots are drawn at phone size on a 1032pt page: a 13pt title and 13pt knots that measure 3.2% of the phone's width and 1.3% of the iPad's

**Where** `src/components/common/IlluminatedHeader.tsx`:216

**Measured** Bright-glyph run analysis across the header row (iPad y 40..74pt, iPhone y 70..104pt). Title 'ORTHODOX KOREA' spans x 430.5..598.5 = 168.0pt on iPad and 118.67..279.67 = 161.0pt on iPhone — the SAME absolute measure, from the same `fontSize: 13, letterSpacing: 3.4`. Glyph height measured 9.0pt (iPad) vs 8.33pt (iPhone), identical within the 0.5pt/0.33pt pixel quantisation. Knots: left knot 410.0..420.5pt (iPad) and 98.0..109.33pt (iPhone) — 10.5pt vs 11.3pt of drawn content from the same `size={13}`. Menu-icon glyph 23.0..36.5pt vs 23.0..37.0pt — identical. As a fraction of the window the title is 168/1032 = 16.3% on iPad against 161/402 = 40.0% on the phone; the knots are 1.26% vs 3.23%. The leaf's own contract names this class explicitly: 'DISPLAY (kt) the day's name, the versal, THE BAND LABELS' — the band labels are the one member of the display class that no code path scales.

**Cause** `brand` (lines 211-219) is a StyleSheet entry, so `fontSize: 13` and `letterSpacing: 3.4` are frozen at import and cannot see the window. The two `<ByzantineKnot size={13} />` calls at lines 125 and 137 are hard literals. The icon size is passed by the caller (TodayScreen.tsx:375/381 `size={19}`, MonthScreen likewise), also literal.

**Fix** Right direction, one wrong multiplier and two omissions.

1. KNOTS: use kt, not k. On the phone the knot box IS the title's fontSize (both literal 13), and the drawn mark measures 11.00pt against an 8.67pt cap height — a 1.27x lockup the owner already signed off on. At k (1.883 on this iPad) the knot becomes a 24.5pt box = 21.5pt drawn against 10.8pt caps = 1.92x, a 51% change to the relationship between a mark and the word it flanks. These knots are not free-standing ornament like the mandorla or the closing rule; they are sized FROM the type and sit on its baseline, so they belong to the display lockup. `<ByzantineKnot size={13 * kt} color={th.accentBright} />` at IlluminatedHeader.tsx:125 and :137 gives 16.2pt box / 14.2pt drawn and holds the ratio at exactly 1.27 at every width. Phone-identical for the same reason as the title: kt is exactly 1.0 at <= 440pt, so 13 * kt is the same double as 13.

2. TITLE: as proposed. IlluminatedHeader.tsx:133 becomes `style={[styles.brand, { fontSize: 13 * kt, letterSpacing: 3.4 * kt }]}` with `const { kt } = useLeaf()` in the component (the header already calls useWindowDimensions, so this adds only the safe-area subscription, which never changes on a phone). 16.2pt / 4.24 on this iPad, title measure ~209pt inside a center slot of roughly 1032 - 32 - 72 - 24 = 904pt, so numberOfLines={1} and brandPress's flexShrink: 1 are never exercised. Keep it an inline array, never a second StyleSheet.create — the size depends on the window and StyleSheet.create runs at import.

3. ICONS: `size={19 * kt}` (23.6pt) is fine, but two things the fix does not say. First, TodayScreen imports only MAX_LEAF_WIDTH from useLeaf today (TodayScreen.tsx:30), so the hook itself has to be taken there and in MonthScreen; AnnouncementsScreen.tsx:212 passes no left/right and needs nothing. Second, do NOT also grow HeadpieceButton's 34x34 box without growing `slot: { width: 36 }` in the same createStyles — the slot has no overflow: hidden, so a button wider than 36pt would spill into the centre and shift the title off the optical centre. 23.6pt inside the existing 34pt box fits with room; if the button chrome is ever scaled, scale the slot in the same edit and inline both.

4. SEQUENCING with the already-diagnosed crown-gradient defect: growing the title from 13 to 16.2pt raises the row's intrinsic height by roughly 4pt, so the band gets taller on iPad. Whoever ties IlluminatedGround's crown to the band height must measure the band AFTER this change, not before, or the crown will be re-tuned to a stale number.

**Phone stays identical because** kt and k are both exactly 1.0 on every phone by the useLeaf ramp (zero below 440pt). `13 * 1`, `3.4 * 1`, `19 * 1` are the same doubles as the literals, so the emitted style objects are identical and the text lays out to the same 161pt. Android is a phone width by the same test. Nothing new is introduced at phone size — no wrapper element, no extra style key.

### `major` The band's closing rule is drawn at scale 1 while the identical ornament 826pt below it is drawn at k — two sizes of the same mark on one page, and only on iPad

**Where** `src/components/common/IlluminatedHeader.tsx`:146

**Measured** Measured band-rule ornament (lozenge + the two flanking pips), gold-pixel cluster around the centre: iPad dx −16..+15 = 31pt wide, 10.5pt max vertical thickness. iPhone: dx −16..+15 = 31pt wide, 10.67pt thickness. IDENTICAL on both devices (the ~1pt shortfall from the drawn 12pt is the `bottom: -2` clip against the band's overflow:hidden, present on both). Now the same component inside the day panel on the SAME screenshot: lozenge 22.0pt tall on iPad, 12.0pt on iPhone; rule width 458.5pt vs 182pt (matching `leaf.width * 0.5` = 474.7 / 185 with the end fades cut off). So on the phone the band's mark and the page's mark are the same mark (10.67pt vs 12.0pt); on the iPad they differ by 2.1x, 826pt apart on one page. As a fraction of the band it closes, the ornament cluster is 31/402 = 7.71% on the phone and 31/1032 = 3.00% on the iPad.

**Cause** A one-word omission with a smoking gun. `OrnamentalRule` takes a documented `scale` prop — IlluminatedOrnaments.tsx:122 says verbatim 'Grows the lozenge, pips and rule weight together on larger screens'. IlluminatedDay.tsx:471 uses it: `<OrnamentalRule width={leaf.width * 0.5} color={th.accentDim} scale={k} />`. IlluminatedHeader.tsx:146 passes neither: `<OrnamentalRule width={width} color={th.accentBright} />`, so `scale` falls to its default of 1.

**Fix** The reviewer's fix is correct as written; I am supplying the exact wiring plus one scope note.

In src/components/common/IlluminatedHeader.tsx:

- add `import { useLeaf } from '../../theme/useLeaf';`
- inside IlluminatedHeader, alongside `const { width } = useWindowDimensions();`, add `const { k } = useLeaf();`
- line 146 becomes `<OrnamentalRule width={width} color={th.accentBright} scale={k} />`

Keep `width={width}` (full window bleed) — the comment at 143-144 is right that this rule is the panel's edge, not a divider, and the colophon's `leaf.width * 0.5` is deliberately a different measure.

Do NOT add any compensating offset for `styles.rule`'s `bottom: -2`. The clipped amount is `(h/2 + d) − (h − 2)` = `2 − scale`, so the 1pt clipped today at scale 1 becomes 0.12pt at k=1.88 — it self-corrects. My measurement confirms the model: predicted visible lozenge 81.4..92.0pt at scale 1 against a measured 81.50..92.00pt.

Verified no new layout risk: `styles.rule` is `position: absolute`, so growing h from 14pt to 26.4pt consumes no layout space, and it grows upward inside the band's `overflow: hidden`. Measured clearance to the brand glyphs (bottom 62.0pt) and the flanking knots (~63pt) is ~6.5pt at the iPad's k; the 34pt icon buttons end at ~74pt but sit in the 36pt margin slots, not at `mid` where the lozenge is. k is bounded in practice by `pageHalo = min(0.61*width, 0.4*usable)` — on the largest iPad (1032x1376) the height term binds at ~437, giving k ≈ 1.88, so the collision case at k > 2.5 cannot be reached on any shipping iPad.

SCOPE NOTE, decide explicitly rather than by omission: this fixes only the rule. The same band still draws two `ByzantineKnot size={13}` marks (IlluminatedHeader.tsx:125, 137) at phone size, and knots are FIGURE-class drawn marks by the same useLeaf rule. Scaling them (`size={13 * k}`) is equally phone-safe for the same k === 1 reason, but it is a separate judgement about the band's whole vocabulary and should be raised as its own finding, not folded in silently.

**Phone stays identical because** k === 1 exactly on every phone, and `scale = 1` is already the parameter's default — so passing `scale={k}` produces the identical `h = 14`, `gap = 26`, `d = 6`, `pip = 2`, `strokeWidth = 1` and the identical SVG path strings on every phone and Android device. This is the strictest kind of safe change: at phone width the new code path is arithmetically the old one.

### `major` The band's centre group fills 23.0% of its slot on iPad against 70.9% on the phone, leaving 354pt of empty wine on each side of the title

**Where** `src/components/common/IlluminatedHeader.tsx`:124

**Measured** The centre slot is `W − 2·spacing.md − 2·slot(36) − 2·gap(8)` = W − 112, i.e. x 56..976 (920pt) on iPad and x 56..346 (290pt) on the phone. Measured knot-to-knot group extent: iPad x 410.0..622.0 = 212.0pt, centred at 516.0 = W/2 exactly; iPhone x 98.0..303.67 = 205.7pt, centred at 200.8 ≈ W/2. Fill: 212.0/920 = 23.0% (iPad) vs 205.7/290 = 70.9% (iPhone). Dead wine per side: (920−212)/2 = 354.0pt on iPad vs (290−205.7)/2 = 42.2pt on the phone — an 8.4x increase in emptiness inside a band that is simultaneously the shortest thing on the page. The composition is not merely small, it has no horizontal structure: a 212pt cluster floating in a 1032pt field.

**Cause** `center` (lines 203-209) is `flex: 1` with `justifyContent: 'center'` and a fixed `gap: spacing.sm`, holding three fixed-width children. Growing the slot therefore only grows the void. Notably the app's OWN non-gilded header solves this and the headpiece dropped the solution: TodayScreen.tsx:398/410 flank the title with `headerLine` = `{ flex: 1, height: 1, backgroundColor: th.accentLine }`, which fills whatever slot it is given at any width.

**Fix** Keep the conditional-render approach and its gap reasoning, but make it self-contained and let the rule fill the slot instead of guessing a length.

In src/components/common/IlluminatedHeader.tsx add `import { useLeaf } from '../../theme/useLeaf';` and, in the component body, `const { k } = useLeaf();`. Then inside `center` (line 124), immediately before the first `<ByzantineKnot>` and immediately after the last, render:

{k > 1 ? <View style={{ flex: 1, height: 1, backgroundColor: th.accentLine }} /> : null}

WHY `k` RATHER THAN A NEWLY EXPORTED `page`: `k` is already on the Leaf type, so this needs no companion edit to useLeaf.ts and no new export. `k = halo / phoneHalo` with `halo = phoneHalo + (pageHalo - phoneHalo) * ramp`, and `ramp = smoothstep(w, 440, 620)` is exactly 0 for every width <= 440pt. `x + y*0 === x` bit-exactly in IEEE-754 for finite y, so `k === 1` exactly on every phone and `k > 1` is false — the identical guarantee the report claimed for `page`, minus the dependency.

WHY `flex: 1` RATHER THAN `120 * page`: 120 is a new fixed constant that does not fill the measure — it reproduces the reported defect one level down (at 1032pt it leaves the group near 60% and the leftover void keeps growing with width, while at a narrow multitasking width a fixed 120pt flank would overflow the slot and force the title to shrink). `flex: 1` is literally the app's own `headerLine` (TodayScreen.tsx:803-807) and consumes exactly the leftover at any width; because flexBasis is 0 the flanks contribute nothing to the base size, so under scarcity all the shrink still falls on `brandPress` / `brand` (flexShrink: 1) and the flanks collapse rather than clipping the title. With the cluster at its measured 212.5pt this yields two ~338pt rules on the 1032pt iPad, and it needs no re-tuning if the cluster is later widened by the kt/k fix.

Leave `justifyContent: 'center'` on `center` (a no-op once the flanks absorb the leftover, and it keeps the phone's declaration untouched). The flank style may stay inline or move into `createStyles` — `useThemedStyles(createStyles)` returns a plain object per theme, not a module-level `StyleSheet.create`, and the flank carries no window-dependent value either way. Do NOT hoist any width-derived value into a module-level StyleSheet.

Drop part (a) of the original fix from this finding; the kt/k growth of the title and knots belongs to the separate scale finding, and this remedy stands on its own without it.

**Phone stays identical because** `page` is exactly 0 for every width ≤ 440pt, so `page > 0` is false on every phone and every Android handset and the element tree is literally unchanged — same three children, same gaps, same 205.7pt group. The 120pt flank is multiplied by 0 before it can reach layout, and it is never mounted at all. The kt/k growth in (a) is the same by-construction identity as fix #3.

### `minor` The travelling sheen is a 130pt streak that covers 12.6% of the iPad band (32.3% on the phone) and never reaches the band's right 282.8pt

**Where** `src/components/common/IlluminatedHeader.tsx`:77

**Measured** `width: 130` fixed / band width: 130/402 = 32.34% (phone), 130/1032 = 12.60% (iPad). Travel is `interpolate(sheen, [0,1], [-width*0.6, width*0.6])`, so the streak's right edge maxes at 0.6W+130 = 371.2pt of 402 on the phone (92.3% of the band is reachable, 30.8pt never lit) but 749.2pt of 1032 on the iPad — 282.8pt, 27.4% of the band, is never lit at all. Conversely the streak is entirely off the left edge whenever tx+130 < 0, i.e. for (0.6W−130)/(1.2W) of each pass: 23.05% on the phone vs 39.50% on the iPad, and the quad in-out easing dwells longest exactly there. Empirically corroborated: profiling the clean band rows (iPad y 31..39pt, iPhone y 45..68pt — below the status bar, above the icon row) gives a horizontal R-channel range of 81.44..81.62 on iPad and 86.57..86.68 on iPhone, i.e. peak-minus-median lift of 0.19 and 0.06 of 255. A sheen in frame would lift R by 5.2 (at its 0.04 minimum opacity) to 15.7 (at 0.12) over #D4AF52. Both captures caught a band with no light on it whatsoever.

**Cause** Two independent literals. `styles.sheen.width = 130` (line 193) is a phone measure frozen in StyleSheet.create. The travel amplitude `±width * 0.6` (line 77) is proportional to width but the streak's static x is 0 (an absolutely-positioned child with a definite width and no left/right resolves to flex-start), so the swept interval is [−0.6W, 0.6W+130] — an interval whose overshoot off the left is 0.6W−130, growing without bound, while its reach past the right stays capped at 130.

**Fix** Ship part (a) only; drop part (b) entirely.

In IlluminatedHeader.tsx, call the leaf and move the width to an inline style:

const { ks } = useLeaf();
...
<Animated.View style={[styles.sheen, { width: 130 * ks }, sheenStyle]}>

and delete `width: 130` from `styles.sheen` (keep position/top/bottom there — only the window-dependent value moves inline, which is the direction CLAUDE.md's StyleSheet.create rule demands).

Leave line 77 untouched. Part (b) is unnecessary as well as wrong: because the endpoints are ±0.6W and the swept span is [−0.6W, 0.6W + sw], widening sw alone already moves every travel metric toward the phone with no ramp at all. With ks ≈ 1.52 on a 1032×1376 iPad (k = 436.8/232 = 1.883, kt = 1.247, ks = sqrt(k·kt) = 1.53), sw = 198pt: streak width 12.6% → 19.2% of the band, right reach 72.6% → 79.2%, dead right region 282.8pt → 214.7pt, off-left dwell 39.5% → 34.0% of the pass. Every one of those is a move toward the phone's 32.3% / 92.3% / 30.8pt / 23.05%, and none of them changes the phone's rhythm of 'sweep in, stop short of the right edge, reverse, rest off-left'.

If the residual dead right region is later judged worth closing, the target at page = 1 must be the phone's own proportions — right edge stopping at 0.6W + sw and left overshoot 0.6W − sw, i.e. ~92% reach and ~23% rest — not the full-bleed [−sw, W] the original fix proposes. That would require a genuinely phone-zero ramp added to Leaf, and should be filed as its own change rather than smuggled in here.

Note on scale class: ks (SPACE) is defensible, but k (FIGURE) is arguably the better fit — the leaf's own doc puts 'every ornament and rule' under k, and a travelling gleam is ornament. k gives sw = 244.8pt (23.7% of the band), closer to the phone's 32.3%. Either is phone-exact; k is the stronger reading of the system. No leaf scalar reaches full proportional parity (that would need 2.56×), and it should not — the phone family itself spans 29.5%–34.7% depending on device width, so exact proportionality is a fiction even there.

**Phone stays identical because** ks = Math.sqrt(k·kt) = Math.sqrt(1) = 1 exactly on every phone, so `130 * ks` is the double 130 — the same value StyleSheet.create holds today. `page` is exactly 0 below 440pt, so both interpolation endpoints collapse to the shipping `-width*0.6` and `width*0.6` terms with the correction multiplied away. The phone keeps its 130pt streak and its ±241.2pt travel bit for bit; Android likewise.

### `minor` The candle pool is sized from WIDTH alone, so the 'broad pool near the top' covers 41.4% of the phone's page and 76.7% of the iPad's

**Where** `src/components/common/IlluminatedGround.tsx`:64

**Measured** `height: width * 1.1` with `top: -80` gives a pool 442.2pt tall ending at y=362.2pt on the phone (41.4% of an 874pt window) and 1135.2pt tall ending at y=1055.2pt on the iPad (76.7% of a 1376pt window) — 1.85x more of the leaf, because the two windows have different aspect ratios (0.460 vs 0.750) and only the width feeds the formula. Visible in the pixels: sampling the right margin, the phone returns to the bare page #F0E8D8 (240,232,216) at y≈353pt and holds it flat from 353 to ~640pt before the foot begins — a clean pool / page / foot structure. The iPad never reaches (240,232,216) until y≈995pt: (237,228,211) at 309pt, (237,229,212) at 505pt, (238,230,214) at 750pt. The 'single very wide, very soft warm gradient BELOW THE HEADPIECE' has become a wash across the entire hero. Secondary: the fixed `top: -80` crops 80/442.2 = 18.1% off the head of the phone's falloff but only 80/1135.2 = 7.0% off the iPad's, so the iPad's band meets the glow at 93% strength against the phone's 82% — compounding the crown smear in finding #1.

**Cause** The comment at lines 60-61 claims the pool is 'Sized from the window so it stays proportionate on a phone and on an iPad', but the expression reads only `width`. On a phone width is the small dimension; on an iPad it is 75% of the height, so the same rule produces a fundamentally different fraction of the page. This is the identical class of error as the crown at line 55 — a vertical extent driven by a quantity that does not track the window's vertical measure.

**Fix** Two edits; the second is the reviewer's, the first is what makes it exist.

1. src/theme/useLeaf.ts — expose the ramp that is already computed, rather than inventing a constant:
   - add to `Leaf`: `/** 0 on every phone, 1 once the window is a page. */ page: number;`
   - return it from the memo (line 100): `return { width, k, kt, ks, halo, page: ramp, spread: wr >= 820 };`
     `ramp` at line 85 is already `smoothstep(wr, PHONE_MAX=440, PAGE_MIN=620)`.

2. src/components/common/IlluminatedGround.tsx:
   - `const { width, height } = useWindowDimensions();`
   - `const { page } = useLeaf();` — destructure ONLY `page`. Do not take `width` from useLeaf: that is the content measure (370pt on a 402pt phone, gutters removed) and would silently change the phone by 8.8%.
   - before the return:
     const poolPhone = width * 1.1;
     const poolH = poolPhone + (Math.min(poolPhone, height * 0.5) - poolPhone) * page;
   - `style={[styles.pool, { height: poolH, borderRadius: width }]}`

Both remain inline styles; the module-level `styles.pool` (left/right/top/opacity) is untouched and still holds nothing window-dependent.

Result: iPad min(1135.2, 688) = 688 -> the pool ends at y=608pt, 44.2% of 1376, against the phone's unchanged 41.4%, and the flat page band between pool and foot returns (608 -> 991 = 383pt, proportionate to the phone's 280pt).

Checked the side effect the reviewer did not: shrinking the height retightens the clamped corner radius on iPad from 568 to 344, so the pool's bottom edge then varies 608pt (centre) to 597pt (x=1032) — an 11pt arc at essentially zero alpha, FLATTER than the phone's own 362->334pt (28pt). The comment's "an arc the eye can trace" concern is not reintroduced. Leave `top: -80` alone as the reviewer says; as a bonus the same change moves the iPad's crop from 7.0% to 11.6% of the falloff, nearer the phone's 18.1%.

Optional, if you would rather not widen the Leaf type: export a pure `leafPage(width: number)` helper from useLeaf.ts alongside the hook and call `leafPage(width)` — IlluminatedGround then needs no second hook and no safe-area dependency. Same arithmetic, same phone safety.

**Phone stays identical because** `page` is exactly 0 for every width ≤ 440pt, so the whole correction term vanishes and `poolH` evaluates to the literal `width * 1.1` shipping today — including on narrow phones like a 320pt SE, where a bare `Math.min(width*1.1, height*0.5)` WOULD have changed the result (352.0 vs 284.0) and is therefore unsafe on its own. The ramp gate, not the min, is what makes this safe. `borderRadius: width` and `top: -80` are untouched.

## The control rows — action pills and the day navigator

### `blocking` The day navigator is not a control any more — it is a 1000pt rail with its arrows 950pt apart, because its only bound (MAX_LEAF_WIDTH = 1100) can never bind on a portrait iPad

**Where** `src/screens/today/TodayScreen.tsx`:770

**Measured** Measured from the two screenshots (px/2 on iPad, px/3 on phone).
• Navigator outer box: iPad x 16.0..1015.5 = 999.5pt wide. iPhone x 16.0..385.7 = 369.7pt. Ratio 2.70x.
• Arrow-button centres (chord midpoints of the two 40pt circles): iPad 40.75 and 990.75 -> 950.0pt apart. iPhone 40.85 and 360.85 -> 320.0pt apart. Ratio 2.97x.
• The date label itself did NOT grow: 'Saturday, August 8, 2026' ink measures 143.0pt on iPad and 134.0pt on iPhone — and that 6.7% is a device text-scale difference, not the leaf (it is present on every unscaled string in the shot), so the label is effectively identical while its container tripled.
• Therefore the whole 630pt of extra width lands in the two flex:1 hairlines. Phone hairline measured 65.0..121.0 = 56.0pt (predicted 57.0 by layout arithmetic, so the arithmetic is validated); the same arithmetic gives the iPad 65.0..431.5 = 366.5pt each. Each connecting rule grows 6.5x while the two things it connects grow 1.0x.
• Context: nothing else drawn on the iPad leaf is wider than 470pt — mandorla ray field 405pt, halo 431.2pt, headline ink 442pt, colophon rule measured 470pt. The navigator is 2.1x the widest drawn element on the page.
• Root cause is one number: content.maxWidth = MAX_LEAF_WIDTH = 1100. Every portrait iPad is narrower than that (mini 744, 10.9" 820, 11" 834, 12.9" 1024, 13" 1032) and the app is portrait-locked, so the bound the comment at TodayScreen.tsx:766-768 was written to provide is unreachable on every shipping device.

**Cause** `content` (TodayScreen.tsx:763-772) bounds the whole scroll column with `maxWidth: MAX_LEAF_WIDTH` (1100). On a 1032pt window that is inert, so `actionRow` (paddingHorizontal 16) and `dayNavigator` (marginHorizontal 16) both stretch to 1000pt. `dayNavLine` is `flex: 1` on both sides of the date, so all surplus width is dumped into two hairlines and the arrows are pushed to the extremes. The leaf's own measure (`leaf.width` = 949.4pt here) is never consulted by these rows, and there is no measure in the system that expresses "a control is one object" as distinct from "the page's text measure".

**Fix** Take the fix as written, with ONE change: use kt, not ks, for the rail.

src/theme/useLeaf.ts — add to the memo and to the Leaf type:
/** The measure a CONTROL row may occupy. A control is one object, not the

- page: its arrows stay within sight of the label they move. Base = the
- widest phone's own control measure (PHONE_MAX minus its two 16pt gutters).
- It grows with DISPLAY, not SPACE, because nothing INSIDE this control
- scales — the arrow buttons are a fixed 40pt and the date is READING class
- — so the box may only take the modest, capped growth that chrome around
- unscaled type is allowed. Never past the leaf. */
  const rail = Math.min(width, (PHONE_MAX - 2 * 16) * kt);
  and return it.

TodayScreen.tsx — call useLeaf() and pass the measure inline (window-dependent, so it cannot live in StyleSheet.create), exactly as proposed:
<View style={[styles.actionRow, { maxWidth: leaf.rail + 2 * spacing.lg }]}> // line 438
<View style={[styles.dayNavigator, isOnToday && styles.dayNavigatorToday,
{ maxWidth: leaf.rail }]}> // line 471
and add width:'100%' + alignSelf:'center' to both stylesheet blocks (835-841, 876-886). Both properties really are required, for the reasons the reviewer gives.

WHY kt: with ks the rail is 408*1.5184 = 620pt — 32% wider than the widest thing drawn on the page (colophon rule, measured 464pt; leaf.width*0.5 at IlluminatedDay.tsx:471), and its hairlines land at 177pt each, still WIDER than the 143pt label they flank, so the control's proportions stay inverted. kt gives 408*1.2404 = 506pt: arrows 456pt apart, hairlines 121pt each (0.85 of the label, against 0.42 on the phone), and the navigator sits in the same width family as the halo (431), the headline (443) and the colophon (464) instead of overtopping all of them. The reviewer's own context paragraph argues for this value and then picks the other one.

PHONE SAFETY IS UNCHANGED BY THE SWAP: kt = min(1 + (k-1)*0.28, 1.36) and k is exactly 1 for wr <= 440 (ramp = smoothstep(wr, 440, 620) = 0), so kt = 1 identically on every phone; rail reduces to min(width, 408) = width by the same arithmetic. maxWidth equal to the box's existing laid-out width does not bind, and alignSelf:'center' with zero free space is a no-op. Verified numerically at 402pt: rail 370, navigator 16..386, hairlines 57 — the shipping values.

TWO THINGS TO TIGHTEN WHILE MAKING THE EDIT:

1. The literal 16 now appears three times for one concept (useLeaf's `wr < 700 ? 16` gutter, the rail base's `2 * 16`, and TodayScreen's `2 * spacing.lg`). Export `const PHONE_GUTTER = 16` from useLeaf.ts, use it in both places there, and note in the TodayScreen call site that `spacing.lg === PHONE_GUTTER` is what makes `rail + 2 * spacing.lg` the actionRow's correct outer measure. If those ever diverge the phone safety proof silently breaks.
2. State in the comment that the proof depends on the ScrollView's content box equalling the window width (true here: portrait-locked, no horizontal safe-area inset, scrollArea has no horizontal padding).

**Phone stays identical because** `rail = Math.min(width, 408 * ks)` reduces to `width` on every phone by arithmetic, not by a branch. PHONE_MAX = 440 is the ramp's zero point, so for any window <= 440pt the smoothstep is 0 and k = kt = ks = 1 exactly; and for wr < 700 the gutter is the literal 16, so `width = wr - 32 <= 440 - 32 = 408`. `Math.min(width, 408 * 1)` therefore always selects `width` — the identical value the rows already lay out to (measured: navigator 16.0..385.7 on a 402pt phone = wr - 32 = 370). The same bound is reused as the rail's base precisely so the two can never drift. On the JSX side, `maxWidth: rail (= 370)` on a box that already measures 370 does not bind, and `alignSelf: 'center'` on a box with zero free space is a no-op, so the phone and Android renderings are byte-for-byte unchanged. (The widest common Android phone is ~412dp -> width 380 < 408, likewise unaffected; a large foldable already crosses the ramp today.)

### `major` The mandorla's rays now climb into the day navigator and paint over it — 19pt of overlap on iPad, where the phone clears it by 16.8pt

**Where** `src/components/common/IlluminatedDay.tsx`:599

**Measured** • `Mandorla` draws its long rays out to `size * 0.47`; the topmost long ray (12 rays, i = 8 and 10) reaches `0.47 * halo * sin 60deg` above the numeral's centre.
• iPad: numeral ink measured y 304.5..407.5 -> centre y = 356.0; halo = 431.2 (confirmed independently — measured horizontal ray span x 313..719 = 406pt = 0.94 x halo). Ray tips therefore at y = 356.0 - 175.5 = 180.5pt. The navigator's outer box measures y 144.5..199.5. The rays enter it by 19.0pt, and because `manuscriptFrame` is a later sibling of `dayNavigator` in the same column, they paint ON TOP of its border. Visible in the crop: two gold diagonals at x 412 and 607.5 crossing the navigator's bottom rule (predicted tips 414.7 and 617.3).
• iPhone: numeral ink y 303.7..359.0 -> centre 331.4; halo 225.1; ray tips at y = 331.4 - 91.6 = 239.8pt against a navigator bottom of 223.0 -> 16.8pt of clearance. The phone composition clears by a hair; the iPad does not clear at all.

**Cause** `hero: { paddingTop: spacing.xxl }` is the fixed constant 32 on both devices, but the clearance the hero has to open is a FIGURE quantity: 0.407 x halo above the numeral's box centre, which goes 91.6pt -> 175.5pt. The numeral's own line box grows with it (`fig(NUMERAL_LINE_HEIGHT)` = 96 -> 178), so half of the growth is absorbed; the other 86.5pt is not, and there are only 32 + 4 + one weekday line above it to absorb it.

**Fix** Same location and same mechanism, with the weekday line credited through the leaf instead of as a phone-sized literal. In IlluminatedDay, where `halo` and `fig` are already in scope (IlluminatedDay.tsx, hero render at ~line 242; `hero` style at line 599):

```ts
// The hero must open far enough for the ray field. Mandorla's long rays run to
// 0.47 * size, and the topmost pair sits at 60deg, so the field reaches
// 0.47 * halo * sin60 = 0.407 * halo above the halo's centre. The numeral's own
// line box absorbs half of that, and the weekday line above it absorbs the rest
// — and BOTH of those are figure quantities, so both are credited through fig().
const heroTop = Math.max(
  spacing.xxl,
  Math.round(0.41 * halo - fig(NUMERAL_LINE_HEIGHT) / 2 - fig(18)),
);
...
<View style={[styles.hero, { paddingTop: heroTop }]}>
```

Result on the iPad (halo 431, k 1.858, fig(96) = 178, fig(18) = 33): 0.41*431 - 89 - 33 = 54.7 -> 55, i.e. +23pt. Ray tips move from 187.5pt to 210.5pt, clearing the navigator's bottom (194.5pt) by ~15pt — a deliberate gap rather than the ~30pt the uncorrected formula produces, so it does not need to borrow 38pt from the rest of the page's rhythm.

PHONE UNAFFECTED, provably. On any width <= 440 the ramp is exactly 0, so halo = min(w*0.56, 232) <= 232, k = 1, and fig() is the identity (round(base * 1)). The candidate is then round(0.41*halo - 48 - 18) <= round(0.41*232 - 66) = round(29.12) = 29 < 32, so Math.max returns spacing.xxl and the inline paddingTop equals the value already in styles.hero — a no-op override. Checked across the range: 375x812 -> 20, 393x852 -> 24, 402x874 -> 26, 440x956 -> 29. I also checked the widest real Android phones (480dp Samsung flagships, where the ramp is already 0.126 today and k = 1.022): halo 237, fig(96) = 98, fig(18) = 18, candidate = round(97.25 - 49 - 18) = 30 — still loses to 32. The candidate only wins once halo > ~246, which requires a device wider than ~500pt, i.e. a tablet or an unfolded foldable, where k > 1 already governs the whole composition.

Optionally apply the same treatment to `marks.paddingTop` (line 641), which has the identical problem on the ray field's lower half; that is a separate finding and the same Math.max(spacing.xl, ...) guard keeps it inert on phones.

**Phone stays identical because** `Math.max(spacing.xxl, ...)` provably selects 32 on every phone, because `halo` is capped at 232 there (`phoneHalo = min(w * 0.56, 232)` and the ramp is 0 at and below 440pt). Worst case is the widest phone: 0.41 x 232 - 96/2 - 18 = 29.1 < 32. Checked across the range — 375x812 -> 20.1, 393x852 -> 24.2, 402x874 -> 26.3, 440x956 -> 29.1 — every one loses to 32, so `paddingTop` stays the literal `spacing.xxl` and the phone hero is unmoved. `fig()` is `round(base * k)` with k exactly 1, so it is the identity on a phone.

### `major` The leaf's vertical rhythm never scales: every gap on the iPad is the phone's gap to within 2pt, while the figures between them are 1.86x — and `ks`, the scale built for exactly this, is dead code

**Where** `src/components/common/IlluminatedDay.tsx`:588

**Measured** Measured gaps, ink-edge to ink-edge, iPad vs iPhone:
• navigator bottom -> 'SATURDAY' top: 47.0 vs 48.3pt (0.97x)
• 'August 2026' bottom -> mark top: 52.5 vs 50.7pt (1.04x) — around a mark drawing that went 44 -> 82pt (fig(44), measured ink 39.7 -> 74.5pt)
• 'Fasting' label bottom -> headline top: 28.0 vs 27.0pt (1.04x)
• headline bottom -> READINGS rubric top: 58.0 vs 56.7pt (1.02x)
• band gold-rule bottom -> action pills top: 13.5 vs 13.5pt (1.00x)
Against figures that grew: numeral digit height 55.7 -> 103.5pt (1.86x), halo 225.1 -> 431.2 (1.92x), mark 39.7 -> 74.5 (1.88x).
Consequence at the foot of the page: the colophon rule sits at y 918 on the iPad with the tab capsule's top measured at y 1294 -> 375pt of blank parchment. On the phone the same interval is ~35pt (rule ~756, capsule top 791). The leaf does not run out of content on the iPad; it runs out of RHYTHM, and stops 375pt short.
Grep confirms `ks` is exported by useLeaf and referenced by nothing in `src/` — the space scale is computed (1.5184 here) and never applied.

**Cause** Every structural gap on the leaf is a raw token: `page.gap: spacing.xl` (588 region, line 578), `hero.paddingTop: spacing.xxl` (599), `hero.gap: spacing.xs` (599), `marks.paddingTop: spacing.xl` and `marks.gap: spacing.lg` (641/638), `band.paddingTop: spacing.lg` (684), `band.gap: spacing.md` (684). `StyleSheet.create` snapshots them at import, so nothing window-derived can reach them, and the one value in the system that was designed to (`ks = sqrt(k * kt)`) is never read.

**Fix** Apply `ks` to the leaf's structural spacing, inline only. All line numbers are in src/components/common/IlluminatedDay.tsx at HEAD.

1. Line 213 — take `ks` and define the space helper beside `fig`/`disp`:

   const { k, kt, ks, halo } = leaf;
   const fig = (base: number) => Math.round(base * k);
   const disp = (base: number) => Math.round(base * kt);
   // SPACE — structural gaps and paddings. Inline, never in the stylesheet:
   // StyleSheet.create snapshots at import, before the window is known.
   const sp = (base: number) => Math.round(base * ks);

2. Line 240 — page:
   <View style={[styles.page, { gap: sp(spacing.xl) }]} key={dateISO}> // 24 -> 36

3. Line 242 — hero (this is where the reported patch had the undefined `heroTop`):
   <View style={[styles.hero, { paddingTop: sp(spacing.xxl), gap: sp(spacing.xs) }]}> // 32 -> 49, 4 -> 6

4. Line 344 — marks (keep `entering` untouched):
   <Animated.View
   style={[styles.marks, { paddingTop: sp(spacing.xl), gap: sp(spacing.lg) }]} // 24 -> 36, 16 -> 24
   entering={FadeIn.delay(STEP * 2).duration(DUR)}

   >

5. Line 391 — bands (MISSING from the reported patch; this is the gap BETWEEN sections, and it is the line the finding is anchored to). Put the inline object last so it also supersedes `bandsWide.columnGap`, since RN's `gap` sets both axes:
   <View style={[styles.bands, wide && styles.bandsWide, { gap: sp(spacing.xl) }]}> // 24 -> 36

6. Lines 465-467 — colophon (also missing). The tailpiece's own standoff is ornament spacing and must grow with the rule it separates:
   <Animated.View
   style={[styles.colophon, { paddingTop: sp(spacing.md) }]} // 12 -> 18
   entering={FadeIn.delay(STEP * 7).duration(DUR * 1.4)}
   pointerEvents="none"
   accessible={false}

   >

7. Lines 543-546 — Band. Add `ks` to the destructure (it currently takes only `k, kt`), define `sp` locally, and scale the band's own frame plus the rubric's lozenge gap (the lozenges are `7 * k`, so their gutter is figure spacing). Keep `style` LAST — `bandColumn` carries only flexGrow/flexBasis/minWidth, so there is no conflict:
   const { k, kt, ks } = useLeaf();
   const sp = (base: number) => Math.round(base * ks);
   ...
   <Animated.View
   style={[styles.band, { paddingTop: sp(spacing.lg), gap: sp(spacing.md) }, style]} // 16 -> 24, 12 -> 18
   entering={FadeInDown.delay(delay).duration(DUR)}
   >
   <View style={[styles.rubric, { gap: sp(spacing.sm) }]}> // 8 -> 12

DELIBERATELY NOT SCALED — these are READING class and scaling them would break the system's own rule that body copy and its leading never grow:

- `bandBody.gap: spacing.sm` (694): the leading between "ROM. 15:30-33" and "MATT.17:24-18:4". The type stays 21pt; opening the gap between two unchanged lines reads as a fault, not as air.
- `commemorationBlock.gap: 2` (707) and `headlineMeta.gap: 2` (703): a title and its own meta are one unit; their internal spacing belongs to the text, not to the page.
- `bandColumn.flexBasis / minWidth: 340` (595): that is a MEASURE, already correct at every width.

EXPECTED RESULT, corrected. At the measured k = 1.859 (ks = 1.5186) the added space on this sparse leaf is +52 (four page gaps) +17 (hero top) +4 (two hero gaps) +13 (marks top) +8 (band top) +6 (band gap) +6 (colophon) ≈ +106pt — about 28% of the ~375pt of dead parchment, not the ~150pt / 40% the report claims. Spacing alone will not fill an iPad and should not be sold as doing so; what it fixes is that the 1.86x figures currently sit in 1.0x air. The remaining void is the separate, correct observation that the leaf's content is simply shorter than a 1376pt window.

**Phone stays identical because** `ks = Math.sqrt(k * kt)`; at and below PHONE_MAX = 440 the smoothstep is identically 0, so `halo === phoneHalo`, `k === 1`, `kt === min(1 + 0, 1.36) === 1`, and `ks === Math.sqrt(1) === 1` exactly (1 is exactly representable and `Math.sqrt(1)` is exactly 1 in IEEE-754). `Math.round(base * 1)` returns the same integer token the stylesheet holds today, so every phone and Android gap is the identical number. The change is arithmetic, not a branch.

### `major` The headpiece shrinks as the device grows: 91pt tall on iPad against 121pt on the phone, with a title block filling 21% of the band instead of 51%

**Where** `src/components/common/IlluminatedHeader.tsx`:99

**Measured** • Band height, measured to the bottom of its gold closing rule (colour 197,159,75): iPad ends at y 91.0pt; iPhone ends at y 121.0pt. The band is 30pt SHORTER on the device that is 2.57x wider and 1.57x taller.
• Brand block ('knot ORTHODOX KOREA knot'), bright-pixel bbox: iPad x 410.0..622.0 = 212.5pt wide, glyph height 9.0pt. iPhone x 98.3..303.3 = 205.3pt, glyph height 8.7pt. Normalising the 6.7% device text-scale offset, the title is effectively the same size on both. As a share of its band: 20.6% on iPad, 51.1% on iPhone.
• Blank wine either side of the title block (from the icon slot's edge at x 48): 362.0pt per side on iPad, 50.3pt per side on iPhone.
• The controls are literally identical: menu glyph bbox 14.0 x 9.0pt on iPad, 14.3 x 9.7pt on iPhone; both buttons sit 12pt from the window edge (icon centres x 29.8 and 29.9).

**Cause** `band.paddingTop = topInset + spacing.sm`, and everything under it is fixed: `row` 34pt icon buttons + `paddingBottom: spacing.sm`, `band.paddingBottom: 10`. So band height = topInset + 60, and the ONLY variable is the safe-area inset — which is 59pt on this iPhone and 24pt on iPad. The band therefore gets smaller as the device gets bigger. Meanwhile `brand` (fontSize 13, letterSpacing 3.4, line 211-219), `ByzantineKnot size={13}` (125/137), `iconButton` 34 (221) and `MenuIcon size={19}` are constants — the band's DISPLAY type never learns it is on a page. This is the one surface CLAUDE.md calls the highest-leverage in the app, and it is the least scaled thing on the screen.

**Fix** Keep the leaf plumbing, add the missed constant, scale the controls, and drop the guard. All in src/components/common/IlluminatedHeader.tsx.

In `IlluminatedHeader` (it already calls useWindowDimensions; useLeaf is safe here — RootApp.tsx:223 mounts SafeAreaProvider, and IlluminatedDay.tsx already uses this exact pattern):

const { kt, ks } = useLeaf();

<View style={[styles.band, {
paddingTop: topInset + Math.round(spacing.sm * ks),
paddingBottom: Math.round(10 * ks), // ADDED — the missed literal
}]}>

<Animated.View style={[styles.row, { minHeight: Math.round(34 * ks) }, parallaxStyle]} ...>

<ByzantineKnot size={Math.round(13 * kt)} color={th.accentBright} /> // both occurrences

<Text style={[styles.brand,
{ fontSize: Math.round(13 * kt), letterSpacing: 3.4 * kt }]} // NO `kt > 1 &&` guard
numberOfLines={1}>

Because `paddingBottom` is now inline it must be REMOVED from `createStyles.band` (line 179) or the inline value wins anyway but the constant becomes a lie — delete it there.

And so the controls stop being phone-sized on a 13-inch page, in `HeadpieceButton`:

const { ks } = useLeaf();
<Pressable style={({ pressed }) => [
styles.iconButton,
{ width: Math.round(34 * ks), height: Math.round(34 * ks) },
pressed && styles.pressed ]} ... >

with the four call sites passing a leaf-sized glyph instead of the literal 19 — TodayScreen.tsx:375,380 and MonthScreen.tsx:539,544 (both files already have a leaf or can take `const { ks } = useLeaf()`):

<MenuIcon size={Math.round(19 * ks)} color={th.brandText} />
<SearchSvgIcon size={Math.round(19 * ks)} color={th.brandText} />

Also widen `styles.slot` inline to match, or the 52pt button overflows its 36pt slot:
<View style={[styles.slot, { width: Math.round(36 * ks) }]}>{left}</View> // both slots

RESULT on iPad Pro 13 (1032x1376, ks 1.52437, kt 1.24331): paddingTop 32+12, row min-height 52, button 52x52 with a 29pt glyph, slots 55, brand 16pt at 4.23 tracking, knots 16, band paddingBottom 15 -> band 111pt (from 92) with a title block ~250pt. The drawn band is 79pt against the phone's 60pt — 1.32x, proportionate rather than either identical or inflated. Month and Announcements inherit it.

PHONE/ANDROID UNAFFECTED, PROVABLY: at wr <= 440 the smoothstep ramp is 0, so halo === phoneHalo, k = halo/phoneHalo = 1 exactly, kt = min(1+0, 1.36) = 1 exactly, ks = sqrt(1) = 1 exactly. I evaluated the real useLeaf source at 402x874 and 440x956: Math.round(8*1)=8, Math.round(10*1)=10, Math.round(34*1)=34, Math.round(36*1)=36, Math.round(19*1)=19, Math.round(13*1)=13, and 3.4*1 === 3.4 compares bit-equal. React Native therefore receives the identical numbers the stylesheet holds today. `minHeight: 34` is inert on the phone because the row's border box measures 42 (34 children + spacing.sm paddingBottom), and 34 < 42. Removing the `kt > 1 &&` guard makes the phone case bit-identical AND removes the 448dp-Android inconsistency the guard would otherwise introduce.

**Phone stays identical because** `kt` and `ks` are both exactly 1 below PHONE_MAX = 440 (see finding 4), so `Math.round(spacing.sm * 1) === 8` and `Math.round(13 * 1) === 13` — the same literals the stylesheet holds. `minHeight: 34` is inert on the phone because the row is already 34pt tall (its `iconButton` children are 34). The `kt > 1 &&` guard is exactly false on every phone, so the brand style array flattens to the untouched `styles.brand`. No Platform check, no new global.

### `minor` Correction to the diagnosed crown wash: the smear is 114.5pt not ~96pt, the iPad band is 91pt not ~110pt, and tying the crown to the band alone would make the top of the page worse

**Where** `src/components/common/IlluminatedGround.tsx`:55

**Measured** Measured directly from the centre and 5%-inset columns:
• iPad: wine band's gold closing rule ends at y 91.0pt; the ground does not reach page parchment (237,229,212) until y 205.0pt (0.15 x 1376 = 206.4, so the stop is behaving as written). Unresolved wash under the band = 114.0pt, and at y 144 the page is still (183,162,147) — nowhere near parchment.
• iPhone: band's rule ends at y 121.0pt; parchment reached at y 129.4pt (0.15 x 874 = 131.1). Unresolved wash = 8.4pt.
• So the ratio is 13.6x, not the ~1.2x the stated note implies. Two things moved in opposite directions: the crown grew (131.1 -> 206.4, x1.57) AND the band shrank (121 -> 91, x0.75). The stated cause names only the first.
• Supporting: `CandleGlow` is drawn at `halo * 1.35` = 582pt on iPad (304pt on phone), reaching 291pt above the numeral centre, i.e. up to y 65pt — clipped by the ScrollView at the band's edge, so its full warm wash lands in exactly the region the crown has already muddied. On the phone it reaches only y 179, well clear of the band at 121.

**Cause** The stated cause (crown tied to 0.15 x WINDOW HEIGHT) is correct as far as it goes and the fix direction is right. What it misses is that the band's height is itself broken (finding 5: band = topInset + 60, so iPad 84-91pt vs iPhone 119-121pt). If the crown is tied to the band's CURRENT height, the iPad's crown would end at ~101pt — 20pt ABOVE where the phone's ends in absolute terms — and the tablet would lose the wine ground the headpiece needs to sit against, trading a smear for a bare edge. The two must be fixed together.

**Fix** Same direction, four corrections: drop the false dependency on finding 5, make the phone branch a literal so the "byte-identical" claim needs no float argument at all, take the band height from one shared helper instead of an onLayout measurement (an onLayout would flash on the first frame, since IlluminatedGround renders BEFORE the header), and clamp so `locations` can never go non-monotonic in a short window.

```tsx
// IlluminatedHeader.tsx — ONE source of truth for the band's geometry, so the
// ground and the headpiece cannot drift apart.
// paddingTop(topInset + sm) + row(34 icon + paddingBottom sm) + paddingBottom 10
export const headpieceHeight = (topInset: number) => topInset + spacing.sm + 34 + spacing.sm + 10;
```

```tsx
// IlluminatedGround.tsx
const { width, height } = useWindowDimensions();
const { k, ks } = useLeaf();
const topInset = useSafeAreaInsets().top;

// The crown must finish just BELOW the band, not at a fraction of the window:
// 0.15 x height tracks the screen, but the thing the wine has to clear is the
// headpiece. On the phone the two coincide (band 121.7pt, crown 131.1pt — a
// ~9pt run-out); on a 1376pt window they diverge by 114pt of mauve smear.
// The run-out is FIGURE-scaled, so it stays proportionate rather than absolute.
const crownStop =
  k > 1
    ? Math.min((headpieceHeight(topInset) + Math.round(10 * ks)) / height, 0.6)
    : 0.15;

<LinearGradient colors={...} locations={[0, crownStop, 0.72, 1]} style={StyleSheet.absoluteFill} />
```

Result: iPad stop moves 206.4pt → ~106pt today, and → ~121pt automatically once the band is corrected — no ordering requirement between the two fixes. Phone and Android are unchanged.

Two notes for whoever lands it. (a) `height` must be the window height and the denominator is only valid because the ground's container IS the full window on the crown screens — I verified this from the pixels: the iPhone settles at ~131 against 0.15x874 = 131.1 and the iPad at ~205 against 0.15x1376 = 206.4. The screens that are NOT full-window (Event/Announcement detail, Settings, Staff, Diagnostics under a native stack header) all pass `crown={false}`, so their colours are background-to-background and the stop is inert there. (b) Do NOT use the `Math.max(0.15 * h, bandH + 10 * ks)` form — the original reviewer is right that it breaks the phone (393x852 → picks 129 over 127.8).

**Phone stays identical because** `k > 1` is exactly false on every phone (the ramp is identically zero at and below PHONE_MAX = 440), so the expression evaluates to the literal `0.15 * height` and the gradient stop is the same float it is today — the phone's measured 129.4pt settle point is untouched, and Android likewise. Note the alternative `Math.max(0.15 * h, bandH + 10 * ks)` form is NOT safe and should not be used: on a 393x852 phone it would select 129 over 127.8 and shift the stop.

## Vertical composition

### `blocking` 364.5pt of dead page below the colophon: the leaf grows ×1.31 while its viewport grows ×1.71, because 350pt of its vertical budget never consults the leaf (ks is dead code)

**Where** `src/components/common/IlluminatedDay.tsx`:578

**Measured** MEASURED from the two screenshots (all values in POINTS, pixels ÷ scale).

Dead field, closing ornamental rule bottom → tab-capsule top edge:
iPhone 766.0 → 790.3 = 24.3 pt = 2.8% of the 874pt window
iPad 929.0 → 1293.5 = 364.5 pt = 26.5% of the 1376pt window (15.0× the phone)

Scroll viewport (band bottom edge → screen bottom):
iPhone 874 − 121.8 = 752.2 pt
iPad 1376 − 91.8 = 1284.2 pt → viewport ×1.707 (+532.0 pt)

Drawn page (action-pill box top → colophon rule ink bottom):
iPhone 134.0 → 766.0 = 632.0 pt = 84.0% of viewport
iPad 104.0 → 929.0 = 825.0 pt = 64.2% of viewport → page ×1.305 (+193.0 pt)

Shortfall = 532.0 − 193.0 = 339.0 pt. Measured growth of the dead field = 364.5 − 24.3 = 340.2 pt. The two agree to 1.2 pt — the entire defect is this one subtraction.

The iPad page cannot even scroll: contentContainer = colophon box bottom 932.0 + page paddingBottom 24 + tabBottomPadding 85 = 1041.0 abs → 949.2 pt of content in a 1284.2 pt scroll view (73.8%). The phone's is 768.4 in 752.2 (102.2%) and still scrolls 16.2 pt.

Where the +193.0 pt actually came from — MEASURED block by block, iPhone → iPad:
hero (SATURDAY ink top → August-2026 ink bottom) 136.0 → 251.0 +115.0 (k)
marks (cross ink top → 'Fasting' ink bottom) 60.4 → 105.0 +44.6 (k / kt)
headline line box 32 → 40 +8 (kt)
rubric line box 13 → 17 +4 (kt)
colophon rule (h = 14·k) 11.7 → 21.5 +12.4 (k)
readings block (ROM ink top → MATT ink bottom) 49.3 → 51.5 +2.2 (never scales — correct)
──────────────────────────────────────────────────────────────── ≈ +186 pt
100% of the growth is FIGURE/DISPLAY. The structural spacing contributed exactly 0.

That structural spacing, measured identical on both devices:
action-pill box 27.0 (iPhone 134.0–161.0) vs 28.0 (iPad 104.0–132.0)
day-navigator box 50.5 (iPhone 173.0–223.5) vs 50.5 (iPad 144.0–194.5) — bit-identical
and the literal constants: actionRow.marginTop 12 + content.gap 12×2 + hero.paddingTop 32 + hero.gap 4×2 + page.gap 24×4 + marks.paddingTop 24 + mark.gap 4 + band.paddingTop 16 + band.gap 12 + bandBody.gap 8 + colophon.paddingTop 12 + page.paddingBottom 24 = 272 pt, plus the two fixed control boxes 78 pt = 350 pt.

Leaf on this iPad: gutter 41.28, width 949.4, k 1.8828, kt 1.2472, ks 1.5324. `ks` is computed at useLeaf.ts:95, returned at :100, and `grep -rn '\bks\b' src/` matches ONLY those two lines plus its type declaration at :57. Nothing in the app has ever read it.

**Cause** Every vertical gap in the leaf is a literal `spacing.*` token baked into `makeStyles`, which StyleSheet.create freezes at import time. `k` and `kt` are threaded through the FIGURE and DISPLAY classes (fig()/disp() at IlluminatedDay.tsx:214-215) but the SPACE class has no equivalent — `sp()` does not exist, and the `ks` that useLeaf computes precisely for this purpose is dead. So the page's ink grows 1.88× while the air between the ink stays frozen at phone dimensions, and the composition's fill ratio falls apart exactly in proportion to how much taller the window is.

**Fix** The diagnosis and the direction are right; three things in the patch are wrong and must be corrected before it is applied.

1. `big` and `ks` ARE NOT IN SCOPE IN `Band` — the L545/L558 edits are a compile error as written. `Band` (IlluminatedDay.tsx:530-561) is a separate function component that destructures `const { k, kt } = useLeaf();` at :543. It must become:

   const { k, kt, ks } = useLeaf();
   const big = k > 1;
   const sp = (base: number) => Math.round(base * ks);

before the L545 and L558 edits can reference them. (Band already uses the bare `k > 1` gate inline at :551, so this is consistent with the file.)

2. `TodayScreen` NEVER CALLS `useLeaf()` — the claim that it "already imports from useLeaf" is only true of `MAX_LEAF_WIDTH` (TodayScreen.tsx:30). The hook has to be added:

   import { MAX_LEAF_WIDTH, useLeaf } from '../../theme/useLeaf';
   const { k, ks } = useLeaf();
   const big = k > 1;
   const sp = (base: number) => Math.round(base * ks);

Phone-safe for the same reason: ks === 1 exactly below 440pt, and `big` is false, so all three inline objects evaluate to `false` and RN's style array skips them.

3. THE RECOVERY NUMBER IS OVERSTATED BY ~21pt. I computed the actual delta token by token at ks=1.53239: the twelve spacing tokens yield +144pt (24→37 ×4 = +52, 32→49 = +17, 12→18 ×2 = +12, and so on), and `dayArrowButton` 40→61 adds +21 to the navigator's height. Total realized = +165pt, not +186.3pt. His 350pt base multiplied the _whole_ 78pt of the two control boxes, but the patch does not touch the action-pill row at all (its 27pt is driven by `typography.size.xs` plus `paddingVertical: spacing.xs`, neither of which is scaled) nor the navigator's own padding/border. Restate the outcome honestly: dead field 364.5 → ~199pt (14.5% of the window), viewport fill 64.2% → ~77%. The residual still belongs to finding #3.

4. SCALE THE ARROW WITH ITS BUTTON. `dayArrowButton` at sp(40)=61pt leaves `ByzantineArrow size={22}` (TodayScreen.tsx:479, :491) as a 22pt glyph inside a 61pt ring — a proportion the phone never shows. The arrow is FIGURE, so either scale it with the button (`size={big ? fig(22) : 22}`, needing `k` in scope) or leave the button unscaled and take the 21pt out of the recovery. Do not ship the 61pt ring around a 22pt mark.

One caveat to state rather than hide: an unfolded Android foldable (~673dp portrait) is already past the ramp and already renders with k≠1 today, so its spacing will change too. That is unavoidable for _any_ fix expressed through the leaf — which is the mechanism the brief mandates — and it is not a phone or a handset. Every iPhone and every conventional Android handset is byte-identical.

Everything else in the patch is correct as written: the eight IlluminatedDay line anchors all match the current file, the token values all match spacing.ts (xs 4, sm 8, md 12, lg 16, xl 24, xxl 32), it uses inline styles rather than a module-level StyleSheet that depends on window size, it introduces no new global constant and no Platform.isPad, and it drops none of the six liturgical marks.

**Phone stays identical because** `ks = Math.sqrt(k * kt)`. For every wr ≤ 440, `ramp = smoothstep(wr, 440, 620)` is exactly 0 (at wr = 440 the clamp gives t = 0), so `halo === phoneHalo`, `k === halo/phoneHalo === 1` exactly, `kt === Math.min(1 + 0*0.28, 1.36) === 1`, and `ks === Math.sqrt(1) === 1` (IEEE-754 exact). Therefore `sp(base) === Math.round(base * 1) === base` for every integer token used here, and each inline style resolves to the identical number StyleSheet already holds — React Native diffs them to no change. Additionally every one of these styles is behind `big = k > 1` (IlluminatedDay.tsx:216), the file's existing phone gate, so on a phone the inline object is `false` and is never even constructed. The widest supported iPhone in portrait is 440 pt (17 Pro Max) and the app is portrait-locked on every device (plugins/withPortraitOnly), so no phone or Android handset can reach the ramp. This changes nothing about which devices are 'phones' — it only adds air where k already differs from 1 today.

### `major` The mandorla overruns the day navigator by 8pt on iPad (phone clears it by 19.5pt) — the halo grows ×1.94 while its clearances stay literal 32/24pt constants and nothing reserves its overflow

**Where** `src/components/common/IlluminatedDay.tsx`:606

**Measured** MEASURED ray-tip positions (deviation-from-row-median ink detector, points):

                                   iPhone            iPad

mandorla top long-ray tip 243.0 186.5
mandorla centre (horiz. ray) 335.4 363.25
mandorla bottom long-ray tip 427.7 540.0
drawn vertical extent 184.7 353.5
day-navigator bottom border 223.5 194.5
first liturgical mark ink top 458.3 547.0

CLEARANCE navigator → halo +19.5 pt −8.0 pt (OVERLAP)
CLEARANCE halo → first mark +30.6 pt +7.0 pt

The overlap is visible: in the iPad crop two diagonal gold strokes emerge from underneath the navigator's bottom rule, because the manuscriptFrame is a later sibling than dayNavigator in the ScrollView and paints on top of it.

Geometry check against the source. Mandorla (IlluminatedOrnaments.tsx) draws long rays to `outer = size * 0.47` at 12 evenly spaced angles; with rays = 12 the long rays (i even) sit at 0°/60°/120°/180°/240°/300°, so the topmost drawn point is 0.47·sin60° = 0.407 × halo from the centre and the drawn vertical extent is 0.814 × halo:
iPhone halo 225.1 → 0.814 × 225.1 = 183.2 (measured 184.7)
iPad halo 436.8 → 0.814 × 436.8 = 355.6 (measured 353.5)

But the box that LAYS OUT is `numeralStack`, whose height is only the numeral Text's lineHeight:
iPhone 96 pt reserved for 184.7 pt drawn → 44.4 pt unreserved per side
iPad 181 pt reserved for 353.5 pt drawn → 86.3 pt unreserved per side
The unreserved overflow grew by +41.9 pt per side while the air meant to absorb it — hero.paddingTop 32, page.gap 24, marks.paddingTop 24 — grew by 0.

Head/body balance, as the same defect seen from the page level:
hero + halo as a share of viewport iPhone 225.1/752.2 = 29.9% iPad 436.8/1284.2 = 34.0%
body (first mark ink → colophon) iPhone 307.7/752.2 = 40.9% iPad 382.0/1284.2 = 29.7%
The head grew and the body shrank — which is exactly 'the top half is crowded while the bottom is empty', and it is the reason the dead field must NOT be closed by growing the hero.

**Cause** `numeralStack` (line 606) has no height of its own: it measures the numeral's line box, fig(96) = 181 pt, while both light layers (`ornamentLayer`, line 609) are `position: 'absolute'` and overflow it freely — by design, per the comment at line 249-265. That design is sound at k = 1 because the fixed 32/24/24 pt clearances happen to exceed the phone's 44.4 pt overflow's visible reach. At k = 1.8828 the overflow is 86.3 pt per side and the clearances are unchanged, so the halo eats its own margins and crosses into the day navigator above and into the marks band below. Nothing in the codebase relates the halo's drawn radius to the space reserved around it.

**Fix** Keep the diagnosis; fix it in IlluminatedDay.tsx, at the right magnitude, with the ray geometry the day actually draws.

1. Compute the reserve where NUMERAL_LINE_HEIGHT and isFeast live (IlluminatedDay.tsx, after line 216 `const big = k > 1;`). Do NOT add a field to useLeaf.

   // THE HALO'S GROWTH, NOT ITS EXTENT. `numeralStack` reserves only the
   // numeral's line box and the mandorla overflows it on purpose (see the note
   // at 249-265); the phone composition is tuned around that overflow. What was
   // never tuned is how the overflow GROWS: the rays reach 0.47 * halo while the
   // box reserves NUMERAL_LINE_HEIGHT/2, so the unreserved part scales with
   // (k - 1). Reserve exactly that difference.
   // rays = 12 -> topmost long ray at 60 deg -> reach 0.47 * sin60
   // rays = 24 (feast) -> a long ray points straight up -> reach 0.47
   // `halo / k` is phoneHalo; the whole term is multiplied by (k - 1), which is
   // 0 at every width <= 440pt because ramp is 0 there. Phone: exactly 0.
   const rayReach = 0.47 * (isFeast ? 1 : Math.sin(Math.PI / 3));
   const haloOverhang = Math.round((rayReach * (halo / k) - NUMERAL_LINE_HEIGHT / 2) * (k - 1));

   iPad values: 41 pt ordinary day, 54 pt feast (vs the proposal's flat 83).

2. Put the reserve on a box that ALWAYS renders — `hero` — symmetrically, so the
   no-marks and no-headline days are covered too:

   L242 <View style={[styles.hero, big && {
   paddingTop: spacing.xxl + haloOverhang,
   paddingBottom: haloOverhang,
   gap: sp(4),
   }]}>

   and leave styles.marks (L344) alone rather than patching only the marks path.
   If finding #1's sp() is also applied to these two paddings, use sp() OR
   haloOverhang, not both: sp(32) already adds +17 top / +13 bottom, and stacking
   them lands at +50.7 / +64.0 against the proportional targets of +32.3 / +48.7.

RESULTING CLEARANCES (iPad, ordinary day, haloOverhang = 41):
navigator -> halo -7.3 -> +33.7 (target 20.1 * ks = 32.3)
halo -> first mark +10.0 -> +51.0 (target 31.8 * ks = 48.7)
i.e. the iPad reproduces the phone's own clearances scaled by ks, which is the
proportionally correct answer, and it consumes ~82pt rather than ~166pt of the
page — so it does not inflate the head the finding itself says is already heavy.
On a feast (haloOverhang = 54) the -36pt overlap becomes +18pt and the marks
squeeze becomes +64pt.

WHY THE PHONE IS BYTE-IDENTICAL: (k - 1) === 0 exactly at every width <= 440pt
(ramp === 0 => halo === phoneHalo => k === 1.0), so haloOverhang === 0 and
spacing.xxl + 0 === 32, paddingBottom 0 === no padding; and `big` is false, so the
inline style object is never applied at all. Same arithmetic that pins k at 1, not
a separate guard. Nothing is added to useLeaf, so the Leaf type and its two
consumers (IlluminatedDay:213, :543) are untouched.

**Phone stays identical because** `haloOverhang = Math.round((halo - phoneHalo) * 0.407)`. Line 91 defines `halo = phoneHalo + (pageHalo - phoneHalo) * ramp`, so whenever `ramp === 0` — every width ≤ 440 pt, i.e. every supported iPhone and Android handset in the portrait-locked app — `halo === phoneHalo` identically and `halo - phoneHalo === 0`, giving `haloOverhang === 0`. `sp(32) + 0 === 32` and `sp(24) + 0 === 24`, the values already in makeStyles. This is the same arithmetic that pins k at 1, not a separate guard that can drift. The styles are additionally behind `big = k > 1`, so on a phone the branch is never taken. Adding a field to the returned Leaf object breaks no existing consumer: the only two call sites destructure explicitly (`const { k, kt, halo } = leaf` at line 213, `const { k, kt } = useLeaf()` at line 543).

### `major` The closing ornament is nailed to the last band instead of to the foot of the leaf: 364.5pt of blank sits BELOW the tailpiece, so the iPad page reads as abandoned rather than finished

**Where** `src/components/common/IlluminatedDay.tsx`:702

**Measured** MEASURED positions of the colophon and what is under it (points):

                                   iPhone              iPad

colophon rule ink 754.3–766.0 (11.7) 907.5–929.0 (21.5)
colophon rule ink width 181.7 466.0
(= leaf.width × 0.5: 370/2 = 185 and 949.4/2 = 474.7, less the end fade)
gap: last reading ink → rule 766.0 − 708.0 = 58.0 929.0 − 859.5 = 69.5
gap: rule → tab capsule top 790.3 − 766.0 = 24.3 1293.5 − 929.0 = 364.5

So the ornament grew correctly (h = 14 × k: 14 → 26.4 pt box, ink 11.7 → 21.5) and it is still positioned by `colophon: { paddingTop: spacing.md }` — a literal 12 pt on both devices. On the phone that 12 pt lands the tailpiece 24.3 pt above the tab capsule, i.e. at the foot of the page, which is precisely why the phone composition reads as resolved. On the iPad the identical 12 pt lands it at 61.5% of the window height with 26.5% of the window blank beneath it.

The scroll view has 335.0 pt of slack it does not distribute: content 949.2 pt in a 1284.2 pt viewport. `contentContainerStyle` (TodayScreen.tsx:435) sets width/maxWidth/alignSelf but nothing about height, and the default `justifyContent: 'flex-start'` pins every child to the top.

Even after finding #1 this is not solved: ks recovers 186.3 pt, leaving 178.2 pt still blank. To reach the phone's 84.0% fill the iPad page must measure 0.840 × 1284.2 = 1078.7 pt against today's 825.0 — a 253.7 pt deficit that the rhythm alone cannot cover, because ks = sqrt(k·kt) is deliberately the conservative geometric mean.

**Cause** A manuscript's tailpiece sits in the FOOT MARGIN; this one sits 12 pt under whatever the last band happened to be, and the page has no concept of a foot at all — `page` (line 575) has a `paddingBottom` but no height, and the ScrollView's content container distributes no slack. On a phone the two are indistinguishable because the content always overflows the viewport, so 'under the last band' and 'at the foot' are the same place. On a 1376 pt window they are 364.5 pt apart, and the ornament that exists specifically so a sparse day does not 'run out a third of the way down and leave void beneath' (the comment at line 458-464) is now doing the opposite: it marks the end of the page a third of the way up.

**Fix** Distribute the slack with FLEX, not with a measured JS margin. Four additions, every one gated `big && ...`, no new state, no new handler, no prop drilling.

TodayScreen.tsx
import { MAX_LEAF_WIDTH, useLeaf } from '../../theme/useLeaf';
const big = useLeaf().k > 1;
...
contentContainerStyle={[styles.content, { paddingBottom: tabBottomPadding }, big && styles.contentFill]}
...
<View style={[styles.manuscriptFrame, big && styles.frameFill]}>
// in makeStyles (static, no window dependence - legal at module level):
contentFill: { flexGrow: 1 },
frameFill: { flexGrow: 1 },

IlluminatedDay.tsx (`big` already exists at L216)
<View style={[styles.page, big && styles.pageFill]} key={dateISO}>
...
<Animated.View style={[styles.colophon, big && styles.colophonFoot]} ...>
// in makeStyles:
pageFill: { flexGrow: 1 },
colophonFoot: { marginTop: 'auto' },

WHY IT CANNOT OSCILLATE - the point the original fix misses. flexGrow and marginTop:'auto' are resolved by Yoga inside the SAME layout pass as the content being measured; nothing is fed back through JS state, so the content height never depends on a previously-measured content height. `contentContainerStyle: { flexGrow: 1 }` is the documented ScrollView idiom for "make the content at least as tall as the viewport", and `marginTop: 'auto'` on the last child collects the resulting free space above it - which IS the foot margin the finding asks for. On this iPad the 335.5pt of slack lands above the tailpiece, putting it at the foot of the leaf with the tab padding (85pt) still intact beneath, i.e. ~16pt of visible air above the capsule against the phone's 24.3pt.

WHY THE PHONE AND ANDROID ARE BYTE-FOR-BYTE IDENTICAL. `big = k > 1` is exactly false on every phone: `ramp = smoothstep(wr, 440, 620)` returns clamp((wr-440)/180, 0, 1) = 0 for all wr <= 440, so `halo = phoneHalo + (pageHalo - phoneHalo) * 0 === phoneHalo` and `k = phoneHalo/phoneHalo === 1` in exact IEEE-754 (x/x = 1 for finite non-zero x). This is the identical construction the file already ships for `big` at IlluminatedDay.tsx:216 and for the Band label at L551, so it introduces no new assumption. A falsy entry in a React Native style array is discarded outright, so the resolved style objects on a phone are byte-identical to today's. Unlike the original fix there is no extra state, no extra onLayout/onContentSizeChange handler and therefore not even the "one extra state write on mount" - the phone render tree is literally unchanged.

TWO FURTHER SAFETY PROPERTIES the original lacks: (1) it is a no-op wherever there is no slack - on a dense iPad day the content already overflows, flexGrow adds nothing and marginTop:'auto' has no free space to collect, so the tailpiece stays exactly where it is; (2) MonthScreen also renders LiturgicalDayPanel, and `pageFill`/`colophonFoot` are inert there because flexGrow only matters when an ancestor hands down free space, which MonthScreen's container does not.

Both new StyleSheet entries are constant literals with no dependence on window size, so they are safe in the module-level StyleSheet.create - the constraint about inline styles does not bite here (contrast the original fix, whose `marginTop: foot` genuinely had to be inline).

**Phone stays identical because** `leaf.k > 1` is exactly false on every phone: `ramp = smoothstep(wr, 440, 620)` is 0 for all wr ≤ 440, so `halo === phoneHalo` and `k === 1` identically — the same construction the file already relies on for `big` (IlluminatedDay.tsx:216). With k === 1, `foot` is the literal 0 and `marginTop: 0` is a no-op against the existing style; the `big &&` guard means the inline object is never even built. The two new state values are set from onLayout/onContentSizeChange, which the ScrollView already fires, and they feed nothing but `foot`, so on a phone they cause one extra state write on mount and no style change whatsoever. Critically this does NOT depend on the phone's content overflowing its viewport — which is why it is safe on a 402×874 iPhone (content 768.4 in 752.2, overflows) and equally safe on a 440×956 iPhone 17 Pro Max (content ~769 in ~831, under-fills).

## Type at page size

### `major` The headpiece — the app's own branded band — is entirely outside the leaf, and collapses to 0.37x its phone page-share, the worst of any element

**Where** `src/components/common/IlluminatedHeader.tsx`:216

**Measured** Measured brand cap height ('ORTHODOX KOREA', light-on-dark, inverted threshold): iPhone 8.33pt, iPad 8.00pt — growth x0.96, i.e. unchanged within the +/-0.5pt @2x quantisation. As a share of window width that is 20.73 -> 7.75 per-mille, a 0.37x collapse — worse than the deliberately-frozen READING class (0.42x) and half the DISPLAY class (0.50x). The whole band measures 92.0pt tall on the iPad against 122.0pt on the phone (wine ends at y=92.0pt / y=122.0pt, confirmed by the closing gold rule at y=86.75pt / y=117.0pt, which sits 5pt above the band's edge given `rule: { bottom: -2 }` and OrnamentalRule h=14). It is SHORTER on the tablet because the only variable in the band is topInset (62pt phone, ~28pt iPad); every other dimension is a literal. So a 1032pt-wide page is crowned by a 92pt band carrying 13pt lettering, 13pt knots, 34pt buttons and a 14pt-tall ornamental rule stretched across 1032pt as a 1pt hairline. The file's own header comment calls this 'the single highest-leverage surface in the app'.

**Cause** IlluminatedHeader takes only `topInset` and never calls useLeaf. brand.fontSize 13 / letterSpacing 3.4 (lines 216-217), ByzantineKnot size={13} twice (lines 125, 137), iconButton 34x34 (line 222), slot width 36 (line 202), and <OrnamentalRule width={width} .../> at line 146 with `scale` left at its default 1 (h=14, lozenge d=6, pips r=2, stroke 1) — all hard literals inside StyleSheet.create or inline JSX constants.

**Fix** Keep the reviewer's structure (call useLeaf() in IlluminatedHeader, express the band through k/kt/ks, all as INLINE styles because they depend on window size; leave createStyles' literals as the phone values so they remain the k=1 result). Add four things it misses:

1. SCALE THE GLYPH, NOT JUST ITS BOX. The icons are passed by the callers, not by HeadpieceButton: `<MenuIcon size={19} .../>` and `<SearchSvgIcon size={19} .../>` at TodayScreen.tsx:374 and 380, and MonthScreen.tsx:538 and 544. Growing the box to 52pt without them leaves a 19pt mark rattling in an empty gold square — visibly worse than today. Either (a) call useLeaf() in both screens and pass `size={Math.round(19 * ks)}` (= 19 on phone, 29 on iPad), or better (b) have HeadpieceButton compute `ks` itself and hand the size down via a render prop / context so the two screens cannot drift apart. Phone-safe either way: Math.round(19*1) === 19.

2. SCALE THE BUTTON'S OWN CHROME. iconButton keeps `borderRadius: radii.sm` (4) and `borderWidth: 1` as literals. A 52pt gold-ruled box with a 4pt corner and a hairline rule is a different shape from the phone's 34/4/1, which is precisely the "differs in character" failure being fixed. Add inline `borderRadius: Math.round(radii.sm * ks)` (4 -> 6) and `borderWidth: Math.max(1, Math.round(ks))` (1 -> 2). Phone: Math.round(4*1)=4, Math.max(1,Math.round(1))=1.

3. MOVE THE RULE'S OFFSET WITH THE RULE. `rule: { bottom: -2 }` (line 220) is a literal while the fix takes OrnamentalRule's h from 14 to 26. The drawn line sits at h/2 from the SVG's top, so today it lands at bandBottom-5 (measured: 117.0pt of a 122.0pt band, 86.75pt of a 92.0pt band). Left alone it would jump to bandBottom-11 on iPad. Make it inline `bottom: Math.round(-2 * k)` so the line stays at bandBottom - 5k (~-9.3pt on iPad) and the rule keeps its proportional distance from the band's edge. Phone: Math.round(-2*1) = -2, the compiled literal. (The band is overflow:'hidden', so the SVG's empty lower half is clipped as it is today — no new bleed.)

4. GIVE THE ROW A MINIMUM HEIGHT SO THE THREE BANDS CLOSE ON THE SAME LINE. AnnouncementsScreen.tsx:212 renders IlluminatedHeader with no left/right, so its row height is governed by the knots, not the buttons. Today's band becomes 32+8+52+8+10 = 110pt while Announcements' becomes 32+8+24+8+10 = 82pt — a 28pt discrepancy between tabs on the same device (today it is ~15pt). Add inline `minHeight: Math.round(34 * ks)` to `styles.row`'s content (or to the two slots) so an empty slot still reserves the button's height. Phone: Math.round(34*1) = 34, which is exactly what the existing 34pt buttons already impose on Today and Month, and it makes Announcements' phone band 15pt taller — so if byte-identical phone output is required, gate this on the row already having a button, or accept it as the one deliberate phone change and get it signed off separately. Flagging it explicitly rather than smuggling it in.

Leave ks (not k) as the class for the buttons and slots: they are tap targets, and k=1.87 would give a 64pt square. Leave the brand on kt and the knots + rule on k, as proposed.

**Phone stays identical because** Below 440pt k = kt = ks = 1 exactly (ks = sqrt(1*1) = 1). Math.round(13*1)=13, Math.round(3.4*1*10)/10=3.4, Math.round(13*1)=13, Math.round(34*1)=34, Math.round(36*1)=36, scale={1} which is OrnamentalRule's existing default. Every value resolves to the literal that is compiled in today, so the phone and Android render identically.

## The hero's geometry

### `blocking` The mandorla's rays climb out of the leaf and cross the day-navigator pill

**Where** `src/components/common/IlluminatedDay.tsx`:599

**Measured** Halo diameter (Mandorla `size`): iPhone 225.12pt (measured 225.5–227.4 by fitting the two upper long rays, |dx/dy| = 0.5755 vs the exact 0.5774), iPad 436.80pt (measured 431.4–435.3). Ray tip-to-tip: 211.6pt horizontal / 183.3pt vertical on the phone (measured 184.5pt, y 243.0→427.5), 410.6 / 355.6 on the iPad (measured 354.0pt, y 186.5→540.5). CLEARANCE TO THE ELEMENT ABOVE — day-navigator bottom border to topmost ray tip: iPhone 223.33 → 243.00 = **+19.67pt clear**; iPad 194.50 → 186.50 = **−8.00pt, i.e. the two 2.6pt gold rays cross the pill's gold border and run 8pt up inside it** (confirmed by crop). Measured against the leaf's own top edge (nav bottom + the 12.0pt `content` gap, identical on both): the rays sit 7.7pt INSIDE the page box on the phone and overhang it by 20.0pt on the iPad. The halo BOX top is at 223.01pt on the phone — 0.3pt under the pill's bottom edge, i.e. exactly kissing it — and at 145.25pt on the iPad, 49.25pt above it, so the halo box covers the whole 50pt navigator.

**Cause** `Mandorla` is rendered inside `styles.ornamentLayer` (position:absolute, filling `numeralStack`), so it takes NO layout space and is free to overflow. The only thing reserving room above it is `hero: { paddingTop: spacing.xxl }` — a hard 32pt. The halo's rise above the numeral's line box is `0.407·halo − fig(96)/2`: 0.407×225.12 − 48 = 43.63pt on the phone, 0.407×436.80 − 181/2 = 87.29pt on the iPad (+43.7pt), while the reserve stays 32pt and the weekday's line box only grows ~14pt. The composition therefore runs out of leaf and spills onto the control above it.

**Fix** Same lever (reserve the overhang inline on `hero`), three corrections.

1. `RAY_RISE = 0.4070` is only the NON-FEAST geometry. `rays = isFeast ? 24 : 12` (IlluminatedDay.tsx:290). With 24 rays the step is 15 deg and `i = 18` lands at exactly 270 deg — and 18 is even, so it is a LONG ray pointing straight up: the tip is at `0.47 * size`, not `0.47 * sin60 * size`. With 12 rays the 270 deg ray is `i = 9` (odd -> short, 0.72 * outer) and the nearest long rays are at 240/300 deg, which is where the `0.47 * sin60 = 0.4070` figure comes from — and my measured |dx/dy| on both screenshots confirms this screenshot is a 12-ray day. So the shipped constant under-reserves by `0.063 * halo` = 27.5pt on this iPad on exactly the days the mandorla exists to dramatise. Make the rise feast-aware instead of picking one branch.

2. `const RAY_RISE = 0.47 * Math.SQRT2 * 0 + 0.4070;` — the first term is identically 0. Drop the dead arithmetic.

3. `0.47` is `Mandorla`'s private `outer` factor (IlluminatedOrnaments.tsx:58). Copying the literal into a second file means editing the mandorla silently breaks the reserve. Export it.

In `src/components/common/IlluminatedOrnaments.tsx`, beside `Mandorla`:

/** The mandorla's outermost ray reach, as a fraction of `size`. Exported

- because the leaf must RESERVE this overhang — the ornament layer is
- absolute and reserves nothing itself. */
  export const MANDORLA_RAY_REACH = 0.47;

and use it at :58 — `const outer = size * MANDORLA_RAY_REACH;` (byte-identical output on every device).

In `src/theme/useLeaf.ts`, add `phoneHalo: number` to the `Leaf` type and return it from the already-computed local at :89 (purely additive).

In `src/components/common/IlluminatedDay.tsx`, after line 216 (`big`, `halo`, `fig` and `isFeast` are all already in scope):

// THE HALO'S OVERHANG IS NOT LAYOUT. Mandorla is drawn in an absolutely
// positioned ornamentLayer, so it reserves nothing; the only room above it is
// hero's paddingTop. Its rise above the numeral's line box is
// rayRise * halo - numeralBox / 2, which grows with the FIGURE scale while
// spacing.xxl does not — so on a page-sized leaf the top rays climb out of the
// leaf and cross the day navigator. Reserve the DIFFERENCE from the phone.
// 24 rays (a feast) put a LONG ray at exactly 12 o'clock; 12 rays put the
// nearest long ray at 60 deg, so a plain day's tip is lower by sin 60.
const rayRise = MANDORLA_RAY_REACH * (isFeast ? 1 : Math.sin(Math.PI / 3));
// strokeLinecap="round" adds strokeWidth / 2 = 1.4 * (size / 232) / 2.
const rayTip = (d: number, numeralBox: number) => (rayRise + 0.7 / 232) * d - numeralBox / 2;
const haloOverhang = Math.max(
0,
rayTip(halo, big ? fig(NUMERAL_LINE_HEIGHT) : NUMERAL_LINE_HEIGHT) -
rayTip(leaf.phoneHalo, NUMERAL_LINE_HEIGHT),
);

then line 242:

<View style={[styles.hero, { paddingTop: spacing.xxl + haloOverhang }]}>

Resulting numbers on this iPad (halo 436.80, phoneHalo 225.12, fig(96) = 181): plain day haloOverhang = 88.60 - 44.30 = 44.30pt -> paddingTop 76.3, top ray tip moves 186.5 -> 230.8pt, i.e. 36.3pt below the navigator (phone 19.7) and 24.3pt inside the leaf's top edge (phone 7.7). Feast day haloOverhang = 116.12 - 58.48 = 57.64pt, which keeps the feast tip clear too — the uncorrected 0.4070 constant would have left a feast day still crossing the pill.

Note this is independent of the already-diagnosed crown-gradient issue: moving the hero down does not shorten the 206pt wine-to-cream wash, and tying the crown to the band's height does not move the rays.

**Phone stays identical because** Identically zero on every phone, by the same arithmetic that makes k = 1: the leaf's ramp is 0 at and below 440pt, so `halo === phoneHalo` and `k === 1` ⇒ `fig(NUMERAL_LINE_HEIGHT) === NUMERAL_LINE_HEIGHT`, hence the two bracketed terms are the same expression and `haloOverhang === 0`. `spacing.xxl + 0 === 32`. It is arithmetic, not an `if`, and not Platform.isPad. Android is a phone-width device on the same path.

### `major` The month-year caption has overtaken the day's own name: `weekday` and `monthYear` are scaled as FIGURE, not DISPLAY

**Where** `src/components/common/IlluminatedDay.tsx`:331

**Measured** Both screenshots share one build; the iPad's own text scale is 1.062× (established from the never-scaled 21pt readings: "ROM. 15:30-33" 127.3→135.0pt = 1.060, "MATT.17:24-18:4" 148.0→157.5pt = 1.064). Dividing it out: weekday glyph-ink 57.3→112.5pt = 1.963/1.062 = **1.848 ≈ 24/13**; monthYear glyph-ink 78.0→156.5pt = 2.006/1.062 = **1.889 ≈ 32/17**; headline ink 332.7→441.5pt = 1.327/1.062 = **1.249 ≈ 30/24** (kt). So the code produces, at scale 1: monthYear 17→32pt and weekday 13→24pt (k = 1.883) against headline 24→30pt and versal 38→47pt (kt = 1.247). HIERARCHY: on the phone headline/monthYear = 24/17 = 1.41 and monthYear sits BELOW the 21pt readings; on the iPad monthYear 32pt > headline 30pt (ratio 0.94) and > readings 21pt — the date caption is now the largest text on the page after the versal, a three-place jump.

**Cause** `useLeaf.ts` lines 20–21 define the classes explicitly — "DISPLAY (kt) the day's name, the versal, the band labels" — but line 244 uses `fig(13)/fig(5)` for the weekday and line 331 uses `fig(17)/fig(1)` for the month-year. Both are DISPLAY type by the leaf's own contract and are being grown by the FIGURE scale, which is 51% larger than kt at this width. The versal and headline correctly use `disp()`, so the two halves of the same heading system diverge.

**Fix** Line 244: `big && { fontSize: disp(13), letterSpacing: disp(5) }` → 16pt / 6pt. Line 331: `big && { fontSize: disp(17), letterSpacing: disp(1) }` → 21pt / 1pt. This restores the phone's ratios almost exactly: monthYear/headline 17/24 = 0.708 → 21/30 = 0.700; weekday/headline 13/24 = 0.542 → 16/30 = 0.533. It also removes ~14pt of line box from above the numeral, so apply it together with the haloOverhang fix rather than instead of it.

**Phone stays identical because** Two independent guarantees. (1) `kt = min(1 + (k−1)·0.28, 1.36)` is exactly 1 whenever k is exactly 1, which is every phone by construction, so `disp(x) === Math.round(x) === x` for the integers 13, 5, 17, 1. (2) `big = k > 1` is false on every phone, so the override object is never even merged — the phone renders `styles.weekday` / `styles.monthYear` verbatim, byte for byte, as it does today.

### `major` The leaf grows its figures 1.88× and its spaces 1.02×; `ks` is computed and referenced nowhere

**Where** `src/theme/useLeaf.ts`:95

**Measured** Measured inter-block gaps, iPhone → iPad: navigator bottom → leaf top 12.00 → 12.00pt (**1.000×**); "Fasting" label bottom → headline cap top 26.67 → 27.50pt (**1.03×**); headline bottom → READINGS rubric top 55.66 → 57.00pt (**1.02×**); last reading bottom → colophon rule top 45.66 → 47.00pt (**1.03×**). The residual 2–3% is text leading, not layout. Against that: halo 225.12 → 436.80pt (1.94×), numeral 86 → 162pt (1.88×), liturgical mark drawing 39.67 → 74.50pt (1.878×), rubric lozenge 7.00 → 13.00pt (1.857×, measured exactly). `ks = Math.sqrt(k · kt)` = 1.5324 at this width; `grep -rn "\bks\b" src` outside useLeaf.ts returns nothing — the SPACE scale is computed and thrown away. This is the root of the two collision findings and of why the iPad reads as a phone page with larger pictures pasted onto it.

**Cause** `useLeaf` declares three scale classes and returns all three, but `IlluminatedDay` destructures only `{ k, kt, halo }` (line 213) and `Band` only `{ k, kt }` (line 543). Every gap in the composition — `page.gap: spacing.xl` (577), `bands.gap` (588), `hero.gap: spacing.xs` (599), `marks.gap: spacing.lg` (638), `band: { gap: spacing.md, paddingTop: spacing.lg }` (684) — is a StyleSheet constant frozen at import time, so the page's rhythm is the 393pt phone's rhythm at every width.

**Fix** Keep the mechanism (pull `ks` from the leaf, apply inline), with three corrections.

A. Destructure it. IlluminatedDay.tsx:213 -> `const { k, kt, ks, halo } = leaf;` and :543 -> `const { k, kt, ks } = useLeaf();`. Add one helper beside `fig`/`disp`: `const sp = (base: number) => Math.round(base * ks);`.

B. Block gaps (as proposed, but never with the `gap` shorthand where a `columnGap` is already in play):

- line 240: `<View style={[styles.page, { gap: sp(spacing.xl) }]} key={dateISO}>` (24 -> 37)
- line 391: `<View style={[styles.bands, wide && styles.bandsWide, { rowGap: sp(spacing.xl), columnGap: sp(spacing.xl) }]}>`. Do NOT append a bare `gap` here: `styles.bandsWide` (line 593) sets `columnGap: spacing.xl`, and with both `gap` and `columnGap` present the gutter Yoga actually uses depends on native prop-parse order rather than the JS array order, so the two-up column gutter can silently stay at 24. Writing both gutters explicitly is unambiguous. Phone unaffected: `wide` requires wr>=820, and at ks===1 both resolve to 24, the value `styles.bands.gap` already gives.
- line 545: `<Animated.View style={[styles.band, style, { paddingTop: sp(spacing.lg) }]} ...>` (16 -> 25)

C. The two ray clearances must scale with `k`, not `ks` — this is the part the original fix misses, and it is the visible collision. `hero.paddingTop` (line 599, spacing.xxl) and `marks.paddingTop` (line 641, spacing.xl) are not rhythm; they exist to hold the mandorla's overflowing rays off the navigator above and the marks below, and the ray overhang is a FIGURE that grows by k=1.88. At ks=1.53 the lower clearance only recovers ~13pt against the iPhone's 31pt, and the upper one still lets the halo escape the leaf. Use the figure scale for these two:

- line 242: `<View style={[styles.hero, { paddingTop: fig(spacing.xxl) }]}>` (32 -> 60)
- line 344: `<Animated.View style={[styles.marks, { paddingTop: fig(spacing.xl), gap: sp(spacing.lg) }]} ...>` (24 -> 45, 16 -> 25)
  Phone safety is the same argument and equally exact: k===1 on every phone by the zero ramp, `Math.round(32*1)===32`, `Math.round(24*1)===24`, `Math.round(16*1)===16` — identical to the frozen constants, so iPhone and Android render byte-for-byte what they render today.

Leave truly intra-element gaps alone (`hero.gap: spacing.xs`, `band.gap: spacing.md`, `bandBody.gap: spacing.sm`, `mark.gap: 4`, `commemorationBlock.gap: 2`): those bind READING-class type, which by the leaf's contract never scales, so scaling their gaps would loosen body copy that has not grown.

Note (cosmetic, not a rendering change): these inline objects are new identities each render. If the re-render churn matters, wrap them in a `useMemo` keyed on `[k, kt, ks]` in IlluminatedDay and on `[k, ks]` in `Band`.

Validation: `npm run typecheck`, then confirm on the iPad simulator that the ray tip clears the navigator and that the marks row no longer sits in the rays, and on a 402pt iPhone that a screenshot diff against the current build is empty.

**Phone stays identical because** `ks = Math.sqrt(k · kt)`, and on every phone k === 1 by the leaf's zero ramp below 440pt, which forces kt = min(1 + 0·0.28, 1.36) === 1, hence ks === Math.sqrt(1) === 1 exactly (no floating-point residue: sqrt(1) is exact in IEEE 754). `Math.round(24 * 1) === 24`, `Math.round(16 * 1) === 16`. Every phone and every Android device renders the identical numbers it does today.

### `major` Clearance under the halo collapses from 31.2pt to 10.5pt — the rays nearly touch the liturgical mark

**Where** `src/components/common/IlluminatedDay.tsx`:641

**Measured** Bottom ray tip → top of the first liturgical mark's ink: iPhone 427.5 → 458.67pt = **+31.17pt**; iPad 540.5 → 551.00pt = **+10.50pt**. Scaled with the figure it would be 31.17 × 1.883 = 58.7pt. The mark itself is correctly in the figure family (box fig(44): 44 → 83pt; measured drawing 38.3×39.67 → 71.0×74.5pt, 1.878×), so it is the gap, not the mark, that broke. Same cause on the same axis as the navigator collision above the halo: the halo's reach below the numeral box grows 43.63 → 87.29pt (+43.7pt) while `marks.paddingTop` stays 24pt.

**Cause** `marks: { paddingTop: spacing.xl }` carries the comment "Clear of the mandorla's rays, which reach below the numeral — without this the first row of marks sits inside the halo and reads as clutter", but 24pt is a constant measured against a 225pt halo. Only 2.7pt of that 24pt is still doing its job at halo = 436.8pt; the rest was consumed by the halo's own growth.

**Fix** Same lever and essentially the same magnitude, but self-contained — the original patch references a `haloOverhang` that does not exist in this file.

STEP 1 — src/components/common/IlluminatedDay.tsx, after `const big = k > 1;` (line 216):

```ts
// HOW FAR THE HALO REACHES BELOW THE NUMERAL. The mandorla is drawn in a
// `halo`-square centred on the numeral's box, so its lowest ink is the long
// rays' tip, 0.47·sin60 of the diameter below that centre (see Mandorla's
// `outer`; the pattern is 180°-symmetric at 12 and at 24 rays, so the same
// reach is owed above). That reach grew with the figure — 43.6pt → 87.3pt —
// while the 24pt beneath it did not, which is what closed the marks row up
// against the rays. Subtracting the SAME expression at k = 1 makes this
// exactly 0 on a phone: `halo / k` is the phone's own halo and
// `fig(NUMERAL_LINE_HEIGHT)` is `NUMERAL_LINE_HEIGHT`, so the two brackets
// are identical and cancel. Not approximately — identically.
const RAY_REACH = 0.47 * Math.sin(Math.PI / 3);
const haloOverhang = Math.max(
  0,
  RAY_REACH * halo -
    fig(NUMERAL_LINE_HEIGHT) / 2 -
    (RAY_REACH * (halo / k) - NUMERAL_LINE_HEIGHT / 2),
);
```

STEP 2 — line 344, merge it inline (never into `makeStyles`, which runs at import time):

```tsx
<Animated.View
  style={[styles.marks, { paddingTop: Math.round(spacing.xl + haloOverhang) }]}
  entering={FadeIn.delay(STEP * 2).duration(DUR)}
>
```

STEP 3 — extend the existing comment on `marks.paddingTop` (line 639) to say the 24 is the PHONE's clearance and that the halo's growth is added inline at the call site, so nobody later "simplifies" the inline style away.

NUMBERS. Phone: `haloOverhang` = 0 exactly, paddingTop = 24, clearance stays 31.0pt. iPad: RAY_REACH·436.8 − 181/2 = 87.32, minus (RAY_REACH·232 − 48) = 46.45, so 40.87 → paddingTop 65, clearance 11.0 → 51.9pt. Proportion check the original finding did not make: clearance as a fraction of the mark's own height goes 0.15× → 0.70× on iPad, against the phone's 0.78× — near-parity, and it lands there without over-padding (a strictly k-proportional 58pt gap would need paddingTop 71 and would push the headline further down an already tall page).

OUT OF SCOPE, worth a separate finding: `marks.gap` (spacing.lg), `mark.maxWidth` (110), the page-level `gap: spacing.xl` and `hero.gap` (spacing.xs) are all unscaled constants too. They belong to a spacing-rhythm finding, not this one; do not fold them in here.

**Phone stays identical because** Same proof as the navigator fix: `haloOverhang` is identically 0 whenever `halo === phoneHalo` and `k === 1`, which the leaf guarantees for every window width ≤ 440pt. `spacing.xl + 0 === 24`. The style is merged inline over the existing `styles.marks`, so nothing else about the row changes.

### `major` CORRECTION to the already-diagnosed crown: the numbers understate it, and it costs the action row 1.94:1 contrast

**Where** `src/components/common/IlluminatedGround.tsx`:55

**Measured** Not re-reporting the cause — measuring it. The app's own band ends at **91.5pt** on the iPad (not ~110pt as stated) and at **121.67pt** on the iPhone, because `insets.top` is 24 vs 59; so the iPad's band is 30pt SHORTER while its crown is 75pt LONGER. The wine finishes at 0.15 × window height = 206.4pt (iPad) / 131.1pt (iPhone) — confirmed by column sampling, the page reaches full cream (237,228,210) at y≈207 and (237,229,212) at y≈133. The smear below the band is therefore **115.5pt on the iPad, not ~96pt**, against **11.4pt** on the phone — a 10× difference, and the two errors compound rather than cancel. CONSEQUENCE NOT PREVIOUSLY STATED: the action-pill row sits inside it. The pill lettering (glyph core measured (109,88,28) on both devices) reads **5.47:1** against the phone's page ground (237,229,212) and **1.94:1** against the iPad's wash (157,131,119) — WCAG AA needs 4.5:1. The pills' gold rule is likewise near-invisible on the mauve.

**Cause** Stated cause is correct: `locations={[0, 0.15, 0.72, 1]}` on a full-window `LinearGradient` makes the wine→page transition 0.15 × WINDOW HEIGHT, a length that has nothing to do with the band. The file's own comment records that 0.22 was rejected because it left the pills on #CABAAC at 3.20:1 — on a 1376pt window, 0.15 reproduces that failure at 1.94:1, i.e. the tuning was done in the wrong unit and the phone only looked right by coincidence.

**Fix** The direction (tie the crown to the band) is right; the reviewer's arithmetic is not. Four things to correct:

1. THE OFFERED "SAFE VARIANT" IS A NO-OP EVERYWHERE. `Math.max(0.15, bandH/windowH)` on the iPad is max(0.15, 91.5/1376 = 0.0665) = 0.15 — today's broken value. It does not "still fix the iPad"; it fixes nothing on any device. `Math.min` would fix the iPad but move the phone (0.1392 != 0.15). Neither works.

2. THE PRIMARY VARIANT VIOLATES THE HARD CONSTRAINT. The reviewer admits it moves phone pixels. Use the leaf's own zero-at-phone ramp instead, which is the mechanism the brief asks for:

   const { k } = useLeaf();
   const ramp = Math.min(Math.max(k - 1, 0), 1); // EXACTLY 0 on every phone
   const crownEnd = 0.15 + ((bandH + spacing.sm) / windowH - 0.15) * ramp;
   locations={[0, crownEnd, 0.72, 1]}

   PHONE SAFETY, BY ARITHMETIC NOT BY BRANCH: useLeaf's ramp is smoothstep(w, 440, 620), zero at and below 440pt, so halo === phoneHalo and k === 1.0 exactly at 402pt (and at every Android phone width — 440 is the leaf system's own stated phone ceiling). ramp is therefore exactly 0, crownEnd evaluates to the literal 0.15 shipping today, and the emitted gradient is bit-identical on iPhone and Android. `locations` is already an inline prop, so no import-time StyleSheet gains a window dependency; `styles.pool` is untouched. On the iPad ramp clamps to 1 (k = 437/232 = 1.88) and the crown finishes at (91.5+8)/1376 = 0.0723 — the pill ground reverts to the cream page and its lettering back to 5.47:1.

3. bandH MUST BE MEASURED, NOT RE-DERIVED. "TodayScreen already knows it" is false: TodayScreen has insets.top but the headpiece's own box lives in IlluminatedHeader (spacing.sm + row + spacing.sm + paddingBottom 10). That nominal sum gives 84pt on this iPad, yet the band measures 91.5pt — the row is taller than its 34pt icon buttons because the brand title goes through ScaledText, so the band grows with Settings -> Text Size. Report the real height with onLayout on the headpiece's outer View and pass it down; a hand-derived constant would drift the moment a reader changes text size.

4. THE TARGET IS THE BAND'S BOTTOM PLUS THE PHONE'S OWN TAIL, NOT THE BOTTOM ITSELF. Ending exactly at bandH puts the whole wine->cream ramp behind the opaque band, so the band butts against pure cream — precisely what the component's doc comment says the crown exists to prevent. The phone's ramp is 93% complete at its band edge ((225,214,198) measured at 122pt against cream (237,229,213)) and keeps a 9.4pt residual dissolve; `bandH + spacing.sm` reproduces that character with an existing token rather than a new constant.

Also: apply it at all three crown call sites — TodayScreen.tsx:358, MonthScreen.tsx:526, AnnouncementsScreen.tsx:206 — not TodayScreen alone. The crown={false} screens are unaffected (their stop 1 sits between two identical background colors).

**Phone stays identical because** NOT byte-identical on the phone, and I will not claim otherwise — this is the one fix here that moves phone pixels. It shifts the phone's wine→cream crossover from 131.1pt to 121.7pt, i.e. it removes the 9.4pt of wash that currently spills under the band; the band, the pills and every element below are unmoved because the gradient is `absoluteFill` behind them and takes no layout space. If the owner requires the phone to be untouched to the pixel, the safe variant is `locations={[0, Math.max(0.15, bandH / windowH), …]}` — that is a no-op at every phone width (0.1392 < 0.15) and still fixes the iPad, at the cost of leaving the phone's existing 9.4pt spill in place.

### `minor` The rubric's lozenge has outgrown the letters it flanks — FIGURE ornament pinned inside a line of DISPLAY type

**Where** `src/components/common/IlluminatedDay.tsx`:547

**Measured** Measured on the "◆ READINGS ◆" row, per-blob: iPhone lozenge 7.00 × 7.00pt beside a 7.33pt cap-height (lozenge = **0.955× the capitals**); iPad lozenge 13.00 × 13.00pt beside a 10.00pt cap-height (lozenge = **1.300× the capitals**). The mark grew 1.857× (= round(7·k), 7 → 13, an exact match to k = 1.8828), the letters grew 1.364× (= kt 1.273 × the iPad screenshot's 1.062 text scale). Whole-rubric width 114.33 → 153.0pt. On the phone the pip tucks just under the cap line; on the iPad it stands a third taller than the word and reads as two bullets rather than as a rubric mark.

**Cause** Inside `Band`, `<RubricMark size={Math.round(7 * k)} />` (lines 547 and 556) sits on the same baseline as `fontSize: Math.round(11 * kt)` (line 551). The pip is classed as FIGURE because it is drawn, but it is set INSIDE a line of display type and its only job is to sit level with those capitals — so it belongs to DISPLAY. Two different scales inside one text run is what breaks it.

**Fix** Keep the substantive edit, drop the cleanup step.

DO: IlluminatedDay.tsx lines 547 and 556 — `size={Math.round(7 * k)}` → `size={Math.round(7 * kt)}`.

DO NOT: "`k` can then be dropped from `Band`'s destructure on line 543." That is wrong — line 551 still uses `k` as the guard for the display override: `k > 1 && { fontSize: Math.round(11 * kt), letterSpacing: Math.round(4 * kt) }`. Removing `k` from line 543 is a tsc error (Cannot find name 'k'), and `npm run typecheck` is this repo's only validation gate.

Two acceptable forms:
(a) Minimal — change only 547 and 556, leave `const { k, kt } = useLeaf();` on line 543 exactly as it is. `k` remains live at line 551.
(b) If the unused-looking `k` is genuinely unwanted, ALSO change line 551's guard from `k > 1` to `kt > 1`, and only then narrow line 543 to `const { kt } = useLeaf();`. This is provably equivalent: `kt = Math.min(1 + (k - 1) * 0.28, 1.36)`, which is > 1 if and only if k > 1, so the guard flips at the identical width and the emitted style object is unchanged on every device.

Either way the pip becomes 9pt on this iPad (0.90× the 10pt cap height, against the phone's 0.955×), and the rubric narrows from 153.0pt to ~145pt since the fixed `spacing.sm` gaps are unchanged.

**Phone stays identical because** `kt === 1` on every phone by the same construction that makes `k === 1` (`kt = min(1 + (k−1)·0.28, 1.36)`), so `Math.round(7 * kt) === Math.round(7 * k) === 7`. The rendered SVG is byte-identical on iPhone and Android; only the multiplier's identity changes.

## Month, Announcements and the root-stack screens

### `blocking` The mandorla is drawn INSIDE the day navigator, and crowds the marks band — `ks`, the leaf's SPACE scale, is computed and never consumed

**Where** `src/components/common/IlluminatedDay.tsx`:641

**Measured** Local-contrast ray detection (a 21pt box high-pass along each row, which cancels the crown wash) on the iPad finds mandorla ray ink at y=190pt (x 414–417 and 614–617) and y=193pt (x 416–419, 612–616) — the day navigator's borders are at y=145 and y=194, so those rays are painted across the navigator's own accentGlow fill, 32pt inside its 49pt interior. Fitting the ray line (Δx/Δy = 0.577 = the 60° long rays) puts the tips at y≈178pt, 16pt ABOVE the navigator's bottom border. The same detector on the iPhone reports rows 210 / 218 / 222 / 226 / 232 / 240 CLEAN; first ray ink is at y=248pt, i.e. 25pt BELOW the navigator's bottom border (223pt). Below the hero the clearance collapses the same way: last ray ink → top of the purple cross is 425→458.7 = 34pt on the phone but 540→551 = 11pt on the iPad. Measured k (three independent glyphs): SATURDAY set width 185.0/97.0 = 1.907, numeral '8' cap height 102.5/55.0 = 1.864, cross mark 71.0/38.0 = 1.868 — the figure grew ~1.88× while every gap around it is byte-identical: hero.paddingTop spacing.xxl = 32, page gap spacing.xl = 24, marks.paddingTop spacing.xl = 24, band.paddingTop spacing.lg = 16 on both devices. `useLeaf` returns ks = sqrt(k·kt) = 1.53 at 1032pt; grepping all of src/ for it finds the definition (useLeaf.ts:95, :100) and ZERO consumers. The same missing scale leaves 376pt of blank page between the colophon (measured centre y=918) and the tab-bar capsule (top y≈1294) on the iPad — 27.3% of the window — against 32pt (3.7%) on the phone (colophon y=760, capsule y≈792); the colophon exists precisely to stop a page reading as unfinished, and at that distance it no longer closes anything.

**Cause** `marks.paddingTop`, `hero.paddingTop`, `page.gap`, `bands.gap` and `band.paddingTop` are literal `spacing.*` constants baked into `makeStyles`, which `StyleSheet.create` freezes at import time. The comment on marks.paddingTop states its job outright — "Clear of the mandorla's rays, which reach below the numeral — without this the first row of marks sits inside the halo" — and 24pt clears a 225pt halo but not a 434pt one. Because the halo is solved against width AND height (pageHalo = min(0.61·width, 0.4·usable); at 1032×1376 the height term binds at 0.4×1084 = 434pt) it grows 1.94× while the rhythm around it grows 1.00×.

**Fix** Keep the mechanism - consume `ks` from the leaf as INLINE styles (makeStyles is frozen by StyleSheet.create at import). Two corrections.

(1) `page.gap` is NOT in the navigator-clearance chain. `hero` is `page`'s FIRST child and a flex gap never applies above the first child, so of the five proposed edits only `hero.paddingTop` sits between the navigator and the halo. At ks=1.520 it goes 32 -> 49 and moves the measured 186.5pt tip to 203.5pt: 9.5pt clear of the 194pt border, under half the phone's measured 20.5pt. Scale that one site by `k`, not `ks`: its job is to clear a FIGURE - the ray overrun above the numeral's own box, measured at 19pt on the phone and 53pt on the iPad (it grows 2.24x, faster than k, because 0.407*halo grows 1.92x while the weekday line + numeral half-height grow only 1.81x). `<View style={[styles.hero, {paddingTop: Math.round(spacing.xxl * k)}]}>` gives 60pt on the iPad, putting the tip at y=214.5 - 20.5pt clear, exactly the phone's absolute clearance - and Math.round(32*1) = 32 at k=1.

(2) Everything else in the list is genuine space and takes `ks` as proposed: `marks` {paddingTop: Math.round(spacing.xl*ks), gap: Math.round(spacing.lg*ks)}, `page` {gap: Math.round(spacing.xl*ks), paddingBottom: Math.round(spacing.xl*ks)}, `bands` {gap: Math.round(spacing.xl*ks)}, and in `Band` (which already calls useLeaf) `[styles.band, {paddingTop: Math.round(spacing.lg*ks)}]`. Verified: page.gap AND marks.paddingTop are BOTH in the halo->marks chain, so +26pt takes the measured 13.4pt halo-tip-to-cross gap to ~39pt against the phone's 32.3pt. That half of the original fix is right as written.

Also add `columnGap: Math.round(spacing.xl*ks)` inline alongside `styles.bandsWide`, or the two-up spread gets a 37pt row gutter against a 24pt column gutter (Yoga's columnGap wins over gap for columns). No phone reaches bandsWide - `spread` requires w >= 820.

Drop the claim that this closes the foot. Measured void is colophon-rule bottom 928.5pt to capsule top 1293.5pt = 365pt on the iPad against 25pt on the phone; these edits add ~100pt of page rhythm and leave ~265pt. That is a separate defect, not something this fix resolves.

**Phone stays identical because** ks = Math.sqrt(k·kt). The leaf's ramp is smoothstep(w, 440, 620), which is exactly 0 for every w ≤ 440pt — wider than any supported phone — so halo reduces to phoneHalo, k = halo/phoneHalo = 1 exactly, kt = min(1 + 0·0.28, 1.36) = 1, and ks = sqrt(1·1) = 1. Math.round(32·1) = 32, Math.round(24·1) = 24, Math.round(16·1) = 16 — the identical integers the stylesheet holds today. This is arithmetic, not a branch: no phone or Android device can reach a non-unit ks in portrait.

### `blocking` `MAX_LEAF_WIDTH` (1100) never binds on any iPad in portrait, so the leaf's gutter is never applied and the day navigator becomes a 1000×50pt rail

**Where** `src/screens/today/TodayScreen.tsx`:770

**Measured** Measured navigator: iPad gold border (184,148,46) at x=16.0 and x=1015.5 (999.5pt wide) and at y=145 and y=194 (49pt tall) → aspect 20.4:1. iPhone: x=16.0..385.7 (369.7pt) × y=174..223 (49pt) → 7.5:1. Everything inside is identical: arrow buttons 40×40 on both, date type 15pt (glyph run 143.0pt/cap+desc 15.0pt on iPad vs 134.0pt/14.0pt on iPhone). So the two `flex: 1` hairlines absorb the entire 630pt difference: (990 − 80 arrows − 159 date box − 16 margins)/2 = 367.5pt each on iPad against (360 − 80 − 150 − 16)/2 = 57.0pt each on the phone — 6.4×, so the hairline-to-date ratio goes 0.38 → 2.31. The page margin is a literal spacing.lg = 16pt on both: 3.98% of a 402pt window, 1.55% of a 1032pt one, while the leaf's own gutter for 1032pt is clamp(1032×0.04, 24, 56) = 41.28pt and leaf.width = 949.44. MAX_LEAF_WIDTH = 1100 exceeds the PORTRAIT width of every shipping iPad (13" M4 1032, 12.9" 1024, 11" M4 834, Air 11" 820, mini 744) and the app is portrait-locked by plugins/withPortraitOnly — so `TodayScreen.content.maxWidth` (line 770) and `IlluminatedDay.page.maxWidth` (line 583) are dead code on every device the app can run on, and `leaf.width` is used for exactly one thing in the whole app: the colophon rule's width.

**Cause** The "ONE MEASURE FOR THE WHOLE PAGE" bound was expressed as the poster ceiling (1100) instead of as the leaf's measure (leaf.width). 1100 is the point past which a leaf stops being a page; it is not the page's width. Since no portrait iPad is that wide, the gutter the leaf computes is discarded and every child falls back to its own `marginHorizontal: spacing.lg`, which is a phone constant.

**Fix** Keep the gutter idea, but derive it from the leaf as an integer and DROP the hairline cap entirely.

(1) GUTTER — express it as the leaf's own gutter, not as a difference of window and leaf.width. Add `gutter` to the Leaf type and return it from useLeaf (the value is already computed at line 76; exposing it changes no arithmetic). Then in TodayScreen: `const leaf = useLeaf();` and `contentContainerStyle={[styles.content, { paddingHorizontal: Math.max(0, leaf.gutter - spacing.lg), paddingBottom: tabBottomPadding }]}`. At 1032pt that is 41.28 - 16 = 25.28pt, so the navigator, the pills and the manuscript frame all land on the leaf's 41.28pt gutter. Why this beats the proposed `(width - leaf.width)/2 - spacing.lg`: useLeaf works off `wr = Math.round(w)` while the proposal uses the raw `width`, so on any device reporting a FRACTIONAL dp width (common on Android: 1440/3.5 = 411.43 -> wr = 411) the expression yields (w - wr)/2 = up to +0.25pt of padding instead of the claimed hard zero. `leaf.gutter` is the literal 16 for every wr < 700, so `Math.max(0, 16 - 16)` is exactly 0 — integer, no rounding, provably byte-identical. (Also note `width` is not currently destructured in TodayScreen; line 89 takes `height` only.)

(2) NAVIGATOR PROPORTION — do NOT put `maxWidth` on `dayNavLine`. Bound the CONTAINER and let the hairlines keep absorbing the slack: `<View style={[styles.dayNavigator, isOnToday && styles.dayNavigatorToday, leaf.spread && { alignSelf: 'center', maxWidth: Math.round(leaf.width * 0.6) }]}>`. At 1032pt that is round(949.44 * 0.6) = 570pt, a plaque of roughly the phone's proportion centred on the leaf, with the flanks still flexing so no free space is stranded. Gate it on `leaf.spread` (wr >= 820), which is part of the leaf API and is false by construction on every phone — the conditional evaluates to `false` and RN drops it from the style array, so the phone path is the unchanged StyleSheet object, not a cap that merely happens not to bind.

(3) If the plaque should also grow rather than only stop stretching, scale its figures through the leaf inline — `dayArrowButton` width/height `40 * k`, `ByzantineArrow size={22 * k}`, `dayNavDate` fontSize `typography.size.md * kt` — all inert at k = kt = 1 on any window <= 440pt. That is optional; (1) and (2) fix the reported defect.

(4) Apply the same `paddingHorizontal` expression to MonthScreen and AnnouncementsScreen, and while there, replace the dead `maxWidth: MAX_LEAF_WIDTH` at IlluminatedDay.tsx:583 (its comment still claims 860) so the page's measure is stated once, in the leaf.

**Phone stays identical because** For any window narrower than 700pt the leaf's gutter is the literal 16, so leaf.width = w − 32 and the expression collapses to (w − (w − 32))/2 − 16 = 16 − 16 = 0 exactly — no rounding involved. Every iPhone (max 440pt) and every Android phone in portrait is far below 700pt, so the padding is a hard zero and the layout is byte-identical. The `maxWidth: 57*ks` on the hairline is 57 on a phone (ks = 1 exactly) while the flank measures 57.0pt there, so the cap is inert. Note precisely: this changes rendering on an Android TABLET at ≥700pt — in the intended direction, but state it rather than claim universal safety.

### `blocking` Gold action-pill lettering measures 1.73:1 on the iPad — worse than the 3.20:1 the crown's 0.15 stop was written to fix

**Where** `src/components/common/IlluminatedGround.tsx`:55

**Measured** The pill row lands at y 104..128pt on the iPad (band bottom 92 + content gap spacing.md 12; pill height 4+4+~14.3 line + 2 border). The background measured across exactly those rows is (148,119,108) at y=104 rising to (173,149,136) at y=128. accentText #6D581C = (109,88,28) against those gives WCAG 1.73:1 … 2.34:1. On the iPhone the same pills sit at y 134..158 on (237,229,212) = 5.47:1. The comment at IlluminatedGround.tsx:50-54 records that ending the crown at 0.22 left the pills on #CABAAC "which measured 3.20:1 for their gold lettering" and moved the stop to 0.15 for that reason — the iPad is 0.9 to 1.5 points BELOW the value already judged unacceptable, and below AA-large (3:1) let alone AA (4.5:1). CORRECTIONS to the already-diagnosed crown numbers: the band is 92pt, not ~110pt (last wine row measured at y=91.5pt at x=4pt; and 92 = insets.top 32 + spacing.sm 8 + row 34 + row paddingBottom 8 + band paddingBottom 10, with the 40pt button top measured at y=40..73). The crown reaches full page cream (237,228,210) at y≈206pt = 0.15×1376 exactly, so the smear is 114pt, not ~96pt. On the phone: band 122pt (button y=70..103 → insets.top 62), cream by y≈130 → 8pt of overlap.

**Cause** Same root as the already-diagnosed defect: `locations={[0, 0.15, 0.72, 1]}` ties the wine-to-page transition to 0.15 × WINDOW HEIGHT, a quantity that grows with the device while the band it is meant to sit under does not. This finding is the measured harm, not a second cause.

**Fix** Make the crown's end a prop, default it to the shipping literal, and drive it off the band's MEASURED height scaled in by the leaf's own ramp — never by a min/max clamp against 0.15.

1. IlluminatedGround.tsx — additive, every existing caller unchanged:
   export function IlluminatedGround({ crown = true, crownEnd = 0.15 }: { crown?: boolean; crownEnd?: number } = {})
   and locations={[0, crownEnd, 0.72, 1]}. `locations` is already an inline prop on a component that calls useWindowDimensions(), so nothing window-dependent enters a module-level StyleSheet.

2. Export the band's interior from IlluminatedHeader (spacing.sm + 34 + spacing.sm + 10 = 60) rather than re-deriving it in the screen, so that when the separate headpiece fix scales that interior by ks the crown follows automatically. bandHeight = insets.top + BAND_INTERIOR; the screen already owns insets.top.

3. Surface useLeaf's existing `ramp` (smoothstep(wr, PHONE_MAX, PAGE_MIN)) as a member of Leaf — call it `page`. It is already computed inside the memo; no new constant is introduced. Then in TodayScreen / MonthScreen / AnnouncementsScreen:

   const { ks, page } = useLeaf();
   const bandHeight = insets.top + BAND_INTERIOR;
   const bandEnd = (bandHeight + spacing.sm * ks) / windowHeight;
   const crownEnd = 0.15 + (bandEnd - 0.15) * page;
   ... <IlluminatedGround crownEnd={crownEnd} />

WHY THE PHONE IS BYTE-IDENTICAL: `page` is exactly 0 at and below 440pt by construction — smoothstep clamps t to 0, which is the same arithmetic guarantee useLeaf.ts already documents for k. So crownEnd reduces to the identical float literal 0.15 on every phone and on Android, and critically it does so INDEPENDENT of insets.top. That is the property a clamp does not have: on an iPhone SE (375x667, insets.top 20, band 80pt) the band fraction is 80/667 = 0.120, or 0.138 with the pad, so any Math.min form would move the SE's crown by 8-20pt while leaving notch phones alone. Interpolating from the literal by a factor that is exactly zero below 440pt is the only form that is safe on ALL phones.

WHAT IT DOES ON THE IPAD: at 1032pt, k = 1.87, kt = 1.24, ks = 1.52, page = 1. crownEnd = (92 + 8*1.52)/1376 = 0.0757 -> the wine finishes at 104pt, 4pt above the pill top at 108pt. Both the pills and the day navigator then sit on full page cream (237,228,210): gold returns to 5.47:1 and the navigator's date to its phone value. Because the expression reads the band's actual height and the pills are laid out below the band inside the ScrollView, it stays correct whether the band is 92pt today or ~111pt after the headpiece fix — the two fixes are independent and can land in either order.

Leaf/CLAUDE.md compliance: no new global constant, no Platform.isPad, no StyleSheet.create dependency on window size (locations stays an inline prop), no text or ScaledText change, and the six liturgical marks are untouched.

**Phone stays identical because** On the phone bandHeight/windowHeight = 122/874 = 0.1396 against today's 0.1500, i.e. the transition would finish 9pt higher — NOT byte-identical. To keep the phone exact, clamp upward from the current value: `locations={[0, Math.max(0.15, bandHeight/windowHeight), 0.72, 1]}`. On every phone 122/874 = 0.140 < 0.15 so Math.max returns the literal 0.15 and the gradient is unchanged to the bit; on the iPad, once the headpiece fix lands, 111/1376 = 0.081 is also below 0.15 — so this clamp alone does NOT fix the iPad and the ratio must instead be the crown's ONLY driver with the phone's 0.15 preserved as a floor in ABSOLUTE points: `locations={[0, Math.max(0.15*874, bandHeight + 9)/windowHeight, ...]}` is a phone constant and therefore disallowed. The safe leaf-expressed form is `Math.max(bandHeight, 0.15*windowHeight/ks) * ks / windowHeight` — on a phone ks = 1 exactly and the second term is 0.15·H, so the expression returns exactly 0.15; on the iPad ks = 1.53 gives max(111, 135)·1.53/1376 = 0.150 → 206pt, unchanged. That last form does not help, which is the honest result: the crown ratio cannot be fixed through ks, only through the band height, and the band height fix necessarily moves the phone unless floored. Ship it as `Math.max(0.15, (bandHeight + spacing.lg*ks)/windowHeight)` ONLY after confirming the phone's (122+16)/874 = 0.158 > 0.15 is acceptable — otherwise this fix is UNSAFE for a byte-identical phone and must be gated on `k > 1`, which is itself derived from the leaf and exactly false on every phone.

### `blocking` The headpiece never touches the leaf: 34pt buttons, a 13pt title and 13pt knots in a 1032pt band whose drawn interior is a phone-constant 60pt

**Where** `src/components/common/IlluminatedHeader.tsx`:216

**Measured** Measured, every part of the band is the same absolute size on both devices. HeadpieceButton: iPad x 13.0..46.5 × y 40..73 (33.5×33.5pt); iPhone x 13.0..46.7 × y 70..103 (33.7×33pt) — the literal 34. Brand 'ORTHODOX KOREA': iPad cap height 9.00pt, set width 212.5pt (x 410.0..622.0); iPhone 8.67pt, 205.3pt (x 98.3..303.3) — the literal fontSize 13 / letterSpacing 3.4. Knots are `size={13}` literals at lines 125 and 137. The band's DRAWN interior is therefore exactly 60pt on both (iPad 92 − insets.top 32; iPhone 122 − insets.top 62), which means the iPad's headpiece is 30pt SHORTER than the phone's — the only thing that grew is the platform inset, and iPad's is smaller. The centre slot is 1032 − 24 (row padding) − 72 (two 36pt slots) − 16 (two gaps) = 920pt on iPad vs 290pt on the phone, and its ink (13 + 8 + 212.5 + 8 + 13 = 254.5pt vs 13 + 8 + 205.3 + 8 + 13 = 247.3pt) fills 27.7% of it on the iPad against 85.3% on the phone — 665.5pt of empty wine. IlluminatedHeader.tsx does not import useLeaf at all.

**Cause** IlluminatedHeader predates the leaf and was never wired to it. It takes only `title`, `topInset`, `left`, `right`, `scrollY` — so its type is DISPLAY class with no kt, its knots are FIGURE class with no k, and its vertical rhythm is SPACE class with no ks. The band is the one surface the iPad change was made FOR (see nativeHeader.ts: the iPad previously "lost the headpiece that is most of the app's character"), and it is the one surface that did not get the scaling system.

**Fix** Wire IlluminatedHeader to the leaf, but use the levers already in the file and fix the arithmetic.

1. `const { k, kt, ks } = useLeaf();` alongside the existing useWindowDimensions. All five changes below are inline styles or props, so nothing touches the useThemedStyles factory.

2. FIGURE (k): both knots `<ByzantineKnot size={Math.round(13 * k)} .../>` (lines 125, 137) -> 24pt at k=1.86. ByzantineKnot has a fixed viewBox="0 0 18 18", so strokes scale with it; nothing else to do.

3. FIGURE (k) — the two ornaments the original report missed:
   - line 146: `<OrnamentalRule width={width} color={th.accentBright} scale={k} />`. The prop ALREADY EXISTS and is documented "Grows the lozenge, pips and rule weight together on larger screens"; the header is the one caller that never passes it. Pair it with `bottom: -2 * k` inline on `styles.rule` so the drawn line keeps its 5pt standoff from the band edge (measured 5.0pt on both devices today) instead of drifting up as h=14*scale grows. -2*1 is exactly -2 on a phone.
   - `styles.sheen` width 130 is a FIGURE literal: 32% of the phone band but 12.6% of the iPad's, so the "light moving over gilt" reads as a thin streak. Inline `{ width: Math.round(130 * k) }` -> 242pt (23%). The travel (`+/- width*0.6`) already scales with the window.

4. DISPLAY (kt): `<Text style={[styles.brand, kt > 1 && { fontSize: Math.round(13 * kt), letterSpacing: Math.round(3.4 * kt * 10) / 10 }]} numberOfLines={1}>` -> 16pt / 4.2 at kt=1.24. Keep the `kt > 1` guard; it is exactly false on every phone.

5. SPACE (ks): band `{ paddingTop: topInset + Math.round(spacing.sm * ks), paddingBottom: Math.round(10 * ks) }`; row `{ minHeight: Math.round(34 * ks), paddingBottom: Math.round(spacing.sm * ks) }`; slot `{ width: Math.round(36 * ks) }` (mandatory — a grown button overflows a 36pt slot); HeadpieceButton calls the same useLeaf and adds `{ width: Math.round(34 * ks), height: Math.round(34 * ks), borderRadius: Math.round(radii.sm * ks) }`; TodayScreen:374/380 and MonthScreen:539/544 pass `size={Math.round(19 * ks)}` to MenuIcon/SearchSvgIcon.

STATE THE RESULT HONESTLY: interior 60pt -> 91pt (12 + [52 + 12] + 15), NOT the 111pt claimed. And kt is capped at 1.36 by design, so the title can never fill a 920pt centre slot: ink goes from 212.5pt (23.1%) to roughly 275pt (~28%). That is correct and should not be forced further — do NOT add a max-width/measure clamp on the row to pull the buttons inward, because the page beneath the band is itself full-bleed on iPad (the date navigator pill spans x 20..1010pt in the screenshot) and a narrower band would break alignment with it. The character is restored by the band's HEIGHT, its 24pt knots, its 52pt buttons and a proportional rule and sheen — not by filling the middle.

Sequencing note: this raises the band from 92pt to ~123pt on iPad, which interacts with the already-diagnosed IlluminatedGround crown (locations fading over 0.15 x window height = 206pt against a ~110pt band). Land the crown-tied-to-band-height fix in the same pass or the mauve smear just shifts rather than clears.

**Phone stays identical because** k, kt and ks are all exactly 1 below 440pt by the leaf's construction (the smoothstep ramp is identically zero at and below PHONE_MAX = 440, so halo = phoneHalo and k = 1, hence kt = 1 and ks = 1). Math.round(13·1) = 13, Math.round(3.4·1·10)/10 = 3.4, Math.round(34·1) = 34, Math.round(19·1) = 19, Math.round(36·1) = 36 — every value resolves to the literal already in the file. Additionally each type change is guarded by `kt > 1`, which is exactly false on every phone, so the style object is not even merged.

### `major` The band's closing ornament is drawn at scale 1 while the identical ornament 830pt lower on the same page is drawn at scale 1.88

**Where** `src/components/common/IlluminatedHeader.tsx`:146

**Measured** Both come from the same `OrnamentalRule`. Measured on the iPad's Today screen: the HEADER rule's centre lozenge is 10.5pt wide at its widest row (y=86.5), with pips 3.5pt across centred at x=501.75 and x=529.75 — ±14.0pt from the rule's centre (515.75), i.e. the untouched `d = 6`, `pip = 2`, `14*scale` at scale = 1. The COLOPHON on the same screen: lozenge 21.5pt (runs 505.0–526.5 at its mid row), pips 6.5pt at x=489.35/542.15 — ±26.4pt = 14×1.883. Ratio 1.88 between two instances of one motif on one page. On the iPhone the two agree exactly (header lozenge 11.0pt with pips at ±14.0pt; colophon at scale 1 too). Motif-to-rule share: phone header 12/402 = 2.99%, iPad header 12/1032 = 1.16%, iPad colophon 22.6/474.7 = 4.76%.

**Cause** `<OrnamentalRule width={width} color={th.accentBright} />` omits the `scale` prop, which defaults to 1 (IlluminatedOrnaments.tsx:123). IlluminatedDay.tsx:471 passes `scale={k}` for the very same component. The rule's LENGTH is already window-driven (`width` from useWindowDimensions), so on iPad the rule stretched 2.57× while its lozenge, pips and stroke weight did not — the one thing OrnamentalRule's own `scale` parameter exists to prevent ("Grows the lozenge, pips and rule weight together on larger screens").

**Fix** Pass the figure scale AND scale the rule's own bottom offset with it, so the ornament keeps the same relationship to the band's edge that it has on the phone.

In IlluminatedHeader.tsx add `const { k } = useLeaf();` (import from '../../theme/useLeaf') and change lines 145-147 to:

<Animated.View
style={[styles.rule, { bottom: -2 * k }, ornamentStyle]}
pointerEvents="none"
accessible={false}

>

    <OrnamentalRule width={width} color={th.accentBright} scale={k} />

</Animated.View>

Why the extra `bottom: -2 * k`. `styles.rule` is `position:'absolute', bottom:-2`, i.e. bottom-anchored, so growing h from 14 to 14k=26.4 pushes the SVG UPWARD, not into the clip. With scale alone the rule line moves from bandBottom-5 (measured: 87.0pt against a 92.0pt band) to bandBottom-11.2 (80.8pt), and the lozenge's lower tip stops crossing the band edge (0.1pt clipped of 22.6 = 0.4%, versus 1pt of 12 = 8% on the phone). Scaling the offset puts the line at bandBottom-5k = 82.6pt and the tip 1.9pt past the edge = 8.3% clipped, matching the phone's proportion - the same drawing, larger. It also keeps the lozenge's top tip at 71.3pt rather than 69.5pt, clear of the brand row (the header buttons bottom out at ~73.8pt and the brand text at 61.5pt, both measured).

The override must be INLINE, not in `createStyles`, because it depends on window size and createStyles is evaluated by useThemedStyles outside the window-size dependency. `ornamentStyle` only sets opacity, so ordering it last is safe.

Do not cite the taller SVG being 'clipped to the band exactly as today' as the justification, and do not make this fix depend on the band's interior growing to ~111pt - the band measures 92.0pt today and the fix fits at that height.

**Phone stays identical because** k = 1 exactly on every phone (the leaf's ramp is zero at and below 440pt), and `scale = 1` is precisely the default the call site relies on today, so every expression inside OrnamentalRule — h = 14·1, gap = 26·1, d = 6·1, pip = 2·1, strokeWidth = 1, cx = mid ± 14·1 — evaluates to the same numbers it does now. Passing scale={k} on a phone is a literal no-op.

### `major` MonthScreen: grid cells invert from portrait to letterbox (52.9×64 → 142.9×64), and the screen has no measure at all

**Where** `src/screens/month/MonthScreen.tsx`:1284

**Measured** Arithmetic at 1032×1376, from the code. `content` (MonthScreen.tsx:1157) declares only `{gap: spacing.md}` — no maxWidth, so unlike TodayScreen the month page has no bound of any kind. `gridCard` (:1253) carries `marginHorizontal: spacing.lg` → 1032 − 32 = 1000pt. `cell` (:1281) is `width: '14.2857%'` → 1000 × 0.142857 = 142.86pt, against `minHeight` 64 for the gilded direction (:1284) → aspect 2.23:1 LANDSCAPE. On the phone the same two lines give (402 − 32) × 0.142857 = 52.86pt × 64 → 0.83:1 PORTRAIT. The cell is 2.70× wider and exactly as tall; the numeral inside stays at typography.size.md = 15pt and the flag pips stay 5×5, so a pip is 9.5% of a phone cell's width and 3.5% of an iPad cell's. Six rows × 64 plus the ~30pt week header = ~414pt of grid in a 1376pt window. `monthNav` (:1221) repeats the Today-screen rail exactly: marginHorizontal spacing.lg → 1000pt wide with 36×36 arrows and a 17pt `monthLabel` at `flex: 1`, so ~890pt of empty capsule. `weekHeaderText` is 12pt centred in each 142.86pt column of a 1000pt wine band. Below all of it MonthScreen renders the same LiturgicalDayPanel → IlluminatedDay, so the 434pt mandorla and all its collision findings are present on this screen too.

**Cause** A percentage width against an absolute minHeight. The percentage tracks the window and the constant does not, so cell aspect is a pure function of device width — the one shape the CLAUDE.md rule about fixed boxes around scaling content warns about, here with the box fixed in the OTHER axis. Compounded by `content` having no maxWidth at all, so nothing bounds the grid card.

**Fix** Add `const leaf = useLeaf();` to MonthScreen and destructure `width` at :118 (`const { width, height: windowHeight } = useWindowDimensions();` — the import is already there at :17). All four changes are inline JSX styles; no module-level StyleSheet gains a window dependency.

(1) GUTTER — keep the reviewer's expression verbatim, it is correct:
`contentContainerStyle={[styles.content, { paddingHorizontal: Math.max(0, (width - leaf.width) / 2 - spacing.lg), paddingBottom: tabBottomPadding }]}` (:595)
iPad: leaf.width = min(1032 − 2·41.28, 1100) = 949.44 → padding 25.28 → gridCard 949.44 → cell 135.6pt. Phone: every phone takes the `wr < 700 ? 16` branch, so leaf.width = w − 32 and the expression is arithmetically (32/2) − 16 = 0; `paddingHorizontal: 0` is a no-op against the current absence of the key. Safe because `IlluminatedGround` is `StyleSheet.absoluteFill` OUTSIDE the ScrollView (:526), so the ground is not inset, and `LiturgicalDayPanel`'s own measure (949.44) still fits inside the remaining 981.44.

(2) CELL HEIGHT — do NOT hardcode 64. Hoist the direction-resolved base so both themes scale from their own value:
`const cellBase = th.direction === 'gilded' ? 64 : 56;   // the same expression as :1284`
`const cellMinHeight = Math.round(cellBase * leaf.ks);`
and apply `{ minHeight: cellMinHeight }` on ALL THREE cell branches — the two empty-cell returns (:636, :641) and the day Pressable (:653) — or the empty leading/trailing cells stay 64 while the day cells grow and the grid's last row breaks.
Phone: the ramp is 0 at or below 440pt, so k = 1 exactly → kt = 1 → ks = sqrt(1) = 1; Math.round(64·1) = 64 and Math.round(56·1) = 56, the identical integers the sheet holds, in BOTH directions. iPad: 98 (gilded) / 86 (elegant) → 135.6 x 98 = 1.38:1, against 2.23:1 today.

(3) PIPS — scale the ROW with the pip or you reintroduce the fixed-box bug:
`const pipSize = Math.round(5 * leaf.k);       // 5 on a phone`
`const pipGap  = Math.round(3 * leaf.k);       // 3 on a phone`
`<View style={[styles.cellPipRow, { height: Math.max(6, pipSize), gap: pipGap }]}>` (:673)
`<View style={[styles.pip, { width: pipSize, height: pipSize, borderRadius: pipGap }, { backgroundColor: … }]} />` (:677, :685, :693)
Phone: k = 1 → 5/5/3 and `Math.max(6, 5)` = 6, i.e. the sheet's literals unchanged. Use `pipGap` (not `pipSize/2`) for the radius so the phone integer stays literally 3; at 9pt a radius of 6 is still ≥ half, so the dot remains a circle. The six liturgical marks are content and none are dropped — only their diameter changes.
Optional, same class, same phone-safety: `{ gap: Math.round(2 * leaf.ks), paddingVertical: Math.round(4 * leaf.ks) }` on the cell so numeral and pips are not clustered at the middle of a 98pt box (2 and 4 on a phone).

(4) DROP the monthNav clause as written — the treatment it references does not exist. Fix (1) already bounds monthNav to 949.44pt. If the empty capsule still reads badly, that belongs in its own finding and should grow the chrome with the leaf rather than add a second measure: `{ width: Math.round(36 * leaf.k), height: Math.round(36 * leaf.k) }` on `monthArrowButton` (:1233) with `size={Math.round(20 * leaf.k)}` on the ByzantineArrows (:606, :616), and `monthLabel` on DISPLAY scale, `{ fontSize: Math.round(typography.size.lg * leaf.kt) }` (:1244) — 36, 20 and 17 on a phone, since k = kt = 1 there.

**Phone stays identical because** The gutter expression is a hard 0 for any window under 700pt (gutter is the literal 16 there, so leaf.width = w − 32) — every iPhone and Android phone. ks and k are exactly 1 below 440pt by the leaf's construction, so Math.round(64·1) = 64, Math.round(5·1) = 5, Math.round(3·1) = 3: the identical integers the stylesheet holds. Same Android-tablet caveat as the TodayScreen gutter — a ≥700pt Android tablet would change, in the intended direction.

### `major` AnnouncementsScreen: 1000pt cards set ~130 characters to the line, and `numberOfLines={3}` stops truncating anything

**Where** `src/screens/announcements/AnnouncementsScreen.tsx`:320

**Measured** `listContent` (AnnouncementsScreen.tsx:320) is `{padding: spacing.lg, gap: spacing.md}` with no maxWidth, so at 1032pt a card is 1032 − 32 = 1000pt and its text measure is 1000 − 2×spacing.md = 976pt. `cardBody` is typography.size.md = 15pt; at a ~0.5em mean advance that is ~130 characters per line, against the phone's (402 − 32) − 24 = 346pt → ~46 characters. The typographic norm is 45–75, so the phone sits inside it and the iPad at 2.8× its top. `numberOfLines={3}` then previews ~390 characters on the iPad against ~138 on the phone: nearly every announcement renders in full in the list and the 'View details' row underneath becomes an affordance with nothing behind it. `cardTopRow` uses `justifyContent: 'space-between'`, so the unread dot sits at x=28 and the relative timestamp at x≈1004 — ~900pt apart on the iPad against ~250pt on the phone, which reads as two unrelated rows. The header is the same unscaled band as the headpiece finding and worse here: the title is the section name ('News' / '소식'), roughly 46pt of 13pt caps in a 1032pt band = 4.5%, against 11.4% on the phone.

**Cause** A FlatList contentContainerStyle with padding but no measure. The card is a `flex` child of a full-window list, so its width is the window's, and the two text sizes inside it are READING class — correctly never scaled — which means the only thing that can hold the line length is the container, and nothing does.

**Fix** Bound the measure ONCE, at the list level, from a height-free quantity. In AnnouncementsScreen add `useWindowDimensions` and `useLeaf`, plus two derived numbers in the component body (never in makeStyles -- StyleSheet.create runs at import time):

const { width } = useWindowDimensions();
const leaf = useLeaf();
// READING never scales, so bound the MEASURE, not the type. 15pt body at a
// ~0.5em mean advance sits mid-norm (~70 characters) at 525pt of text; the
// card adds its own 2 x spacing.md.
const cardMax = Math.min(leaf.width, 2 * spacing.md + 35 * typography.size.md); // 24 + 525 = 549
const listGutter = spacing.lg + Math.max(0, (width - cardMax) / 2 - spacing.lg);

then inline it on the FlatList (replacing lines 232-236):

contentContainerStyle={[
styles.listContent,
{ paddingHorizontal: listGutter, paddingBottom: tabBottomPadding },
showEmpty && styles.listContentEmpty,
]}

Why the list and not the card: centering by padding bounds the plain card AND the ReanimatedSwipeable wrapper with its Delete action, so the staff row does not stay full-bleed while the card shrinks. Why not ks: cardMax depends only on leaf.width and the reading size, both height-free, so a Stage Manager or Split View height change cannot alter the line length -- which `leaf.width / ks` would, in the wrong direction.

Numbers at 1032pt: leaf.width = 1032 - 2 x clamp(41.28, 24, 56) = 949.44; cardMax = min(949.44, 549) = 549; listGutter = 16 + max(0, (1032 - 549)/2 - 16) = 241.5; card = 549, measure 525 -> ~70 characters, inside the 45-75 norm. numberOfLines={3} then previews ~210 characters instead of ~390, so "View details" has something behind it again, and the unread dot and timestamp sit ~460pt apart instead of ~975.

If 483pt of empty gutter reads as too austere for a news feed, the leaf already carries the alternative: `numColumns={leaf.spread ? 2 : 1}` (spread is wr >= 820, false on every phone) with `columnWrapperStyle={{ gap: spacing.md }}`, giving two ~494pt cards at 1032pt -- ~63 characters -- and using the page rather than leaving it blank. That variant needs a `key` that changes with numColumns (FlatList requires a remount) and makes swipe-to-delete awkward in a grid, so ship the measure bound first.

Do not describe either as "the same as Today and Month" -- neither screen does this today; Today's MAX_LEAF_WIDTH = 1100 is inert at 1032pt and Month has no measure at all. If a single form is wanted across the three screens, that is a separate change to Today and Month, not a claim about the current tree.

**Phone stays identical because** The gutter term Math.max(0, (w − leaf.width)/2 − spacing.lg) is a hard 0 below 700pt because leaf.width = w − 32 there, so paddingHorizontal stays the literal spacing.lg. The card's maxWidth resolves to leaf.width/1 = 370pt on this iPhone, and the card is already exactly 370pt wide (402 − 2×16), so the cap is inert to the pixel; on any phone it equals w − 32, which is exactly what the card measures today. Android tablets ≥700pt would change, as with the other two screens.

### `minor` Root-stack screens: the crown defect does NOT reach them (confirmed), but all three are unbounded full-width rows

**Where** `src/screens/settings/SettingsScreen.tsx`:302

**Measured** Confirmed by reading all three call sites — SettingsScreen.tsx:155, EventDetailScreen.tsx:152 and AnnouncementDetailScreen.tsx:134 each render `<IlluminatedGround crown={false} />`, and with crown false the gradient's colours are [background, background, background, backgroundDeep] (IlluminatedGround.tsx:44-48): there is no wine at stop 0, so the 0.15×H geometry has nothing to smear and the already-diagnosed defect is arithmetically absent from these screens. The light pool is drawn on them, but its shape is proportionate (borderRadius/height = 221/442 = 0.50 on the phone, 567.5/1135 = 0.50 on the iPad) and its rounded top corner solves to y = +11.8pt at x=0 on the iPad — behind the platform header — so no traceable arc appears. What IS wrong is measure: all three declare `content: {padding: spacing.lg}` with no maxWidth (SettingsScreen.tsx:302, EventDetailScreen.tsx:267, AnnouncementDetailScreen.tsx:226), so a card is 1032 − 32 = 1000pt and its inner measure 1000 − 2×spacing.lg = 968pt. `linkRow` (SettingsScreen) is `justifyContent: 'space-between'` with a 15pt `linkText` left and the '›' chevron right, so 'Parish staff' and its chevron sit ~950pt apart against ~290pt on the phone; `hint` at typography.size.sm = 13pt runs ~149 characters to the line against ~52 on the phone.

**Cause** These screens were written before the leaf and never bounded. They are correct to pass crown={false} — that decision is sound and should not be revisited — but the same absence of a measure that affects the tab screens applies here, with the additional wrinkle that a `space-between` row has no upper bound at all, so its two ends are pushed to the container's edges no matter how wide it gets.

**Fix** Use Part A's mechanism with Part B's quantity, so the measure is centred by construction and no per-card edits are needed. In each of the three screens add `const { width } = useWindowDimensions();` and `const leaf = useLeaf();`, then one derived value: `const measure = Math.round(leaf.width / Math.max(1, leaf.ks));` and one inline entry appended to the existing contentContainerStyle array (keeping each screen's current paddingBottom expression untouched): `{ paddingHorizontal: spacing.lg + Math.max(0, (width - measure) / 2 - spacing.lg) }`. Phone (w=402): measure = round(370/1) = 370, (402-370)/2 = 16, 16-16 = 0, so paddingHorizontal = spacing.lg = 16 — the literal that `padding: spacing.lg` already produces (Yoga resolves HORIZONTAL over ALL, the same mechanism the existing appended paddingBottom already relies on). iPad (w=1032): measure = 620, (1032-620)/2 = 206, so paddingHorizontal = 206 and the content column is exactly 620pt, centred with no alignSelf needed. This bounds the `space-between` linkRow at its container, so 'Parish staff' and its chevron are ~556pt apart instead of ~966pt, and drops the hint's line from ~149 to ~90 characters. It touches only contentContainerStyle in the three files, stays inline (no module-level StyleSheet reading window size), and expresses everything through leaf.width and ks. Do NOT add a bare maxWidth to `card`/`linkGroup` — without `alignSelf: 'center'` it left-pins them; if a per-card cap is ever wanted anyway it must carry `alignSelf: 'center'` alongside `width: '100%'`.

**Phone stays identical because** Both expressions are identities below 700pt: leaf.width = w − 32 makes the gutter term exactly 0 so paddingHorizontal stays the literal spacing.lg, and ks = 1 exactly below 440pt makes leaf.width/max(1,ks) = leaf.width = w − 32, which is precisely the width the card and linkGroup already occupy inside a spacing.lg-padded container. Android tablets ≥700pt would change; Android phones would not.

### `minor` `mark`'s `maxWidth: 110` is a fixed box around a figure that scales 1.87× and a label that scales 1.25×, and it adds a row to the Korean marks band

**Where** `src/components/common/IlluminatedDay.tsx`:643

**Measured** IlluminatedDay.tsx:643 declares `mark: {alignItems: 'center', gap: 4, maxWidth: 110}`. Inside it the drawing is `size={fig(44)}` — measured 38.0×39.7pt on the phone and 71.0×74.5pt on the iPad (ratio 1.868) — and the label is `disp(12)`, measured 'Fasting' at 40.7pt wide on the phone and 54.0pt on the iPad (ratio 1.328, consistent with fontSize 12→15 and letterSpacing 0.8→1). So the label column is 2.50× the mark's width on the phone and 1.34× on the iPad while the box itself never moves. In Korean the longest label, '선성체 성찬예배' (7 syllable blocks plus a space), needs about 7×15 + 6×1 = 111pt at iPad size against a 110pt cap and so breaks to the second line that `numberOfLines={2}` permits, where at phone size 7×12 + 6×0.8 = 88.8pt keeps it on one. No mark and no label is lost — all six still render, `numberOfLines` is 2 not 1 — so this is a rhythm defect, not a violation of the liturgical-marks rule.

**Cause** The one dimension in the marks band that was left as a literal. `size` uses fig(), `fontSize` and `letterSpacing` use disp(), and the box that contains both uses neither — exactly the pattern CLAUDE.md flags: a fixed-size box around scaling content.

**Fix** Split the two by class — the gap is space, the wrap cap is display — and gate the override on `big` so the phone path is syntactically as well as arithmetically untouched.

In `IlluminatedDay` destructure ks (currently `const { k, kt, halo } = leaf;` at line 213 -> `const { k, kt, ks, halo } = leaf;`), then at line 346:

<View key={mark.key} style={[styles.mark, big && { maxWidth: disp(110), gap: Math.round(4 * ks) }]}>

`disp` is the existing `(base) => Math.round(base * kt)` at line 215. On the iPad that is maxWidth 137 and gap 6.

Why kt and not ks for maxWidth: the cap governs where a LABEL breaks, so it must track the label's own type. 110/12 = 9.17 em on the phone; 137/15 = 9.13 em on the iPad — the same measure in ems, so every label keeps the phone's line count in both languages. It still clears the reviewer's stated goal ('선성체 성찬예배' at 15 pt with letterSpacing 1 is ~117 pt < 137, one line, as on the phone) while 'Presanctified Liturgy' (~152 pt) stays two lines exactly as the phone sets it. It also stays comfortably wider than the 83 pt drawing, so the box never crushes the figure. `Math.round(4 * ks)` = 6 restores the mark-to-name distance to 1.53x, which sits between the type's 1.25x and the figure's 1.88x — the geometric mean is the right choice for a gap that separates one from the other.

Do NOT hoist either value into `makeStyles`: StyleSheet.create runs at import time and both depend on window width. Inline is required.

**Phone stays identical because** ks = 1 exactly below 440pt by the leaf's construction (k = kt = 1 there, so sqrt(1·1) = 1), giving Math.round(110·1) = 110 and Math.round(4·1) = 4 — the literals already in the stylesheet. The inline object merges the same numbers over the same keys, so the rendered box is unchanged.

## Not yet done

The synthesis pass that would have merged overlapping findings into one ordered
plan did not run (session limit), so several entries describe the same defect from
different lenses — the crown, the halo/navigator overlap and the band's scale each
appear more than once. Merge them before implementing rather than fixing anything
twice.
