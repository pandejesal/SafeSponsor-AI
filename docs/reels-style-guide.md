# SafeSponsor AI — Reels Style Guide & Google Flow Prompt Packs

Based on analysis of @ensotrade.tech (EnsoTrade) Instagram reels:
"Meet Gary", "Bloomberg who?", and "Retail vs institutions".

---

## 1. The Style DNA (copy this, not the product)

Ensotrade's formula — all of it translates 1:1 to SafeSponsor AI:

1. **Faceless character storytelling.** One relatable loser figure whose specific,
   numbered failures escalate comically. No talking head, no zoom call.
2. **Enemy framing.** "Retail idiots vs. the people who actually know." Our version:
   "Brands that guess vs. brands that vet."
3. **Dry roast with absurd specificity.** Concrete numbers ($99/month, 12 indicators,
   3 accounts) instead of vague jokes. Ours: 2M followers, $50K deposit, 4,000 toxic comments.
4. **3-act micro-arc.** Hook (indictment) → escalation x3 → the pivot line
   (*"…it's EnsoTrade."* → *"…it's SafeSponsor AI."*).
5. **Full-script captions.** The story lives in the caption; the video is AI visuals
   (character + charts) with a calm voiceover.
6. **Product revealed only at the end** as "the secret the pros use."
7. **Bio CTA.** Ensotrade: "Engineered for Profitability. Coming soon!" →
   SafeSponsor: suggest "Vet before you sponsor. Coming soon!" or similar.

---

## 2. Brand Tokens (use in every prompt)

| Token | Value |
|---|---|
| Background | Near-black `#09090b` |
| Accent 1 | Cyan `#06b6d4` |
| Accent 2 | Orange `#f97316` |
| Text | White `#fafafa` |
| Logo | `public/logo.svg` (dark hexagon, cyan+orange interlocking rings, white "S") |
| House style | Dark terminal/monitor aesthetic — charts, order books, scan feeds, dark UI panels, glowing cyan/orange data |

**Logo rule (matches Ensotrade — logo appears only on the end card):**
feed `logo-1024.png` as the reference image for the final title card only.

**Character rule (consistent across scenes):** generate the character ONCE with
Omni Flash, then use that generated image as the **reference image** for every Veo
3.1 clip so the face/build/outfit stay identical.

**Voiceover rule:** calm, deadpan, slightly dry narrator voice. Reads the caption
script word-for-word. ~2.4 words/sec.

---

## 3. Prompt Pack 1 — "Meet a Brand Manager" (the Gary classic)

> Hook | 3 escalating sponsor failures | pivot reveal. The flagship.

### Omni Flash — scene images (one per scene)

**Character reference (generate first, reuse everywhere):**
> "Studio portrait of a tired, middle-aged brand manager named Dave in a wrinkled
> dress shirt with a loosened tie, glasses, defeated expression, sitting in a dark
> office lit by monitor glow, flat vector-cartoon style, muted colors, dark navy
> background, centered, eyes slightly downcast."

**Scene 1 (hook, 0–2s):**
> "Dark flat-vector cartoon scene. A cluttered office desk at night, monitor glow
> on a tired brand manager's face. Floating holographic stat above the screen:
> '2,000,000 followers'. He looks smug. Near-black background, cyan and orange
> accent light, text overlay bottom-third: 'THE NUMBER ONE MISTAKE'"

**Scene 2 (failure 1, 2–5s):**
> "Same flat-vector cartoon office. The brand manager watches a laptop crash scene,
> his face turning pale. A giant red 'SPONSORSHIP GONE' stamp in the background.
> Dark UI panels with 'BRAND SAFETY: 4/100' in orange. Near-black palette, cyan and
> orange accents."

**Scene 3 (failure 2, 5–8s):**
> "Same character, now clutching his head. Wall covered in screens showing hateful
> comment threads and toxic emoji. Big orange warning icon. Text overlay: '4,000
> TOXIC COMMENTS — NOBODY CHECKED'. Near-black background, cyan/orange scheme,
> flat-vector cartoon."

**Scene 4 (failure 3, 8–11s):**
> "Same character slumped at his desk, a competitor brand's logo watermark burned
> on his laptop screen. Single cyan spotlight. Text overlay bottom: 'HE SIGNED THE
> COMPETITOR'S CREATOR THAT WEEK'. Near-black, flat-vector."

**Scene 5 (pivot, 11–14s):**
> "Dark terminal-style dashboard filling the frame: a creator dossier with a glowing
> circular brand-safety score ring (cyan), red flag list (orange), toxicity bar chart.
> Slight camera pull. No character. Text overlay: 'THIS ISN'T A SECRET BLACKLIST'"

**Scene 6 (end card, 14–16s):**
> "Minimal dark title card, near-black background, subtle cyan/orange grid. Large
> white bold text: 'SAFESPONSOR AI' with the uploaded SafeSponsor logo above the
> text. Tagline below in gray: 'Vet before you sponsor.'"

### Veo 3.1 — motion prompts (one clip per scene)

- **Clip 1 (2s):** "Slow push-in on the cluttered night office desk; the brand
  manager leans forward smugly as the holographic follower counter glows; subtle
  screen flicker." — 1080x1920
- **Clip 2 (3s):** "The manager watches his laptop screen crash; red stamp slams
  into frame with a shake; his expression sours; one office light flickers off."
- **Clip 3 (3s):** "Camera slowly orbits the manager clutching his head while hate
  comment tiles scroll on the wall screens behind him."
- **Clip 4 (3s):** "Static medium shot; he slumps in the chair, head in hands;
  competitor watermark glows brighter on the laptop; slow zoom out."
- **Clip 5 (3s):** "Slow pull-back from the glowing brand-safety score ring;
  orange red-flag chips stack up beside the toxicity chart; data panels update."
- **Clip 6 (2s):** "Gentle zoom out on the title card; grid lines faintly scroll;
  logo shimmers once."

### Voiceover (deadpan narrator, 16s)

> "Meet Dave. Two million followers, and a brand safety score of four.
> Sponsor number one: the influencer who'd say anything for a check. Gone in one
> video. Sponsor number two: four thousand toxic comments nobody checked. Sponsor
> number three: he signed the competitor's creator — that week. This isn't a secret
> blacklist. It's SafeSponsor AI. Vet before you sponsor."

### Caption (full-script style — paste as-is)

> 2M followers. Brand safety score: 4/100. Meet Dave.
> Sponsor 1 - the guy who'd say anything for a check. Gone in one video.
> Sponsor 2 - 4,000 toxic comments. Nobody checked. Naturally.
> Sponsor 3 - the creator signed with his competitor the same week.
> This isn't a secret blacklist. It's SafeSponsor AI.
> Vet before you sponsor. 🛡

---

## 4. Prompt Pack 2 — "Brands Aren't Guessing" (the institutions classic)

> Mirror of the "retail vs institutions" reel: amateurs guess, big brands vet.

### Omni Flash — scene images

**Character reference:**
> "Flat-vector cartoon of a cocky young social-media 'growth hacker' with a hoodie,
> oversized headset, gold chain, smirk, sitting in a neon-lit bedroom surrounded by
> follower-count posters; near-black background, cyan and orange neon accents."

**Scene 1 (0–2s):** "The growth hacker posts a sponsorship deal meme on a giant
phone screen; text overlay: 'BRANDS JUST PICK ANYONE, RIGHT?'"
**Scene 2 (2–5s):** "Split scene: left side the hacker swiping creators randomly;
right side a dark boardroom silhouette studying a dossier on a glowing projector
screen with score rings and red flags. Text: 'GAMBLE' vs 'VET' in cyan and orange."
**Scene 3 (5–8s):** "Extreme close-up on the dossier page: contract clauses,
toxicity bars, conflict markers, a big stamped green checkmark."
**Scene 4 (8–11s):** "Wide shot of the hacker's phone with a 'REJECTED' notification
and a confused face. Dark office glow."
**Scene 5 (11–14s):** "Terminal dashboard filling frame with circular score ring,
comment toxicity chart, competitor-conflict chips. Pull back."
**Scene 6 (14–16s):** "Same title card as Pack 1 with the SafeSponsor logo
(reference image) and 'SAFESPONSOR AI'."

### Veo 3.1 — motion prompts

- **Clip 1 (2s):** "Slow zoom in on the giant phone as the meme posts; neon lights
  pulse once."
- **Clip 2 (3s):** "Split screen cross-fade between the swiping hacker and the
  boardroom silhouette; the dossier sheet slides into view."
- **Clip 3 (3s):** "Macro dolly down the dossier page; the green check stamp hits
  with a subtle screen shake."
- **Clip 4 (3s):** "The hacker's phone lights up with REJECTED; he freezes; slow
  pull back into the dark room."
- **Clip 5 (3s):** "Data panels animate: ring fills to 92, bars climb, chips stack;
  smooth push-in."
- **Clip 6 (2s):** "Gentle zoom out on the title card; logo shimmers."

### Voiceover (16s)

> "Think brands just pick anyone? That's cute. The smart ones run a dossier before
> they spend a dollar: brand safety scores, comment toxicity, competitor conflicts,
> contract clauses. Amateurs gamble. Professionals vet. This isn't a secret agency
> playbook. It's SafeSponsor AI. Vet before you sponsor."

### Caption

> Think brands just pick anyone?
> The smart ones run a dossier first. Score. Toxicity. Conflicts. Clauses.
> Amateurs gamble. Professionals vet.
> Not a secret agency playbook — it's SafeSponsor AI. 🛡

---

## 5. Prompt Pack 3 — "The $50K Plug" (short punchy burner)

> The "Bloomberg who?" equivalent — one-sentence roast, no story arc.

### Omni Flash scenes

- **Scene 1 (0–3s):** "Flat-vector cartoon: a desperate startup founder holding a
  $50,000 stack of bills next to a vending machine labeled 'INFLUENCER'. The
  machine eats the cash and prints a cigarette-pack-size 'DEAL' receipt. Near-black,
  cyan/orange neon."
- **Scene 2 (3–6s):** "The vending machine screen explodes into a glowing
  brand-safety dashboard with score ring and red flags; the founder's jaw drops."
- **Scene 3 (6–8s):** "Title card with SafeSponsor logo (reference image) and
  'SAFESPONSOR AI'."

### Veo 3.1 motion

- **Clip 1 (3s):** "The vending machine devours the cash with a mechanical chug;
  the receipt slides out; founder stares."
- **Clip 2 (3s):** "Machine screen dissolves into the dashboard; ring fills; flags
  stack; the founder's eyes widen."
- **Clip 3 (2s):** "Zoom out on the title card; logo shimmer."

### Voiceover (8s)

> "Fifty grand into an influencer vending machine. Most brands print a deal
> receipt — smart ones print a dossier first. SafeSponsor AI. Vet before you sponsor."

### Caption

> $50K in, receipt out. 🤡
> Most brands print a deal. Smart ones print a dossier first.
> SafeSponsor AI — vet before you sponsor. 🛡

---

## 6. Google Flow Production Notes

1. **Upload `logo-1024.png`** (exported from `public/logo.svg`) into Google Flow
   assets and attach it as the **reference image** for every end-card scene.
2. Generate each character image once in Omni Flash, save it, and attach that
   image as the **reference** for its Veo clips (keeps the face consistent).
3. Keep on-screen text short (<= 4 words) — text rendered inside Omni Flash
   images is cleaner than text generated by video models.
4. Render 1080x1920 (9:16). Voiceover at ~2.4 words/sec; 60-90 wpm deadpan.
5. Edit captions with word-for-word VO sync — Ensotrade's captions carry the story.
6. Post cadence: it takes 27 posts of this genre to build a recognizable face —
   batch 3 reels, then iterate on which hook wins.