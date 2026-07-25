---
title: Spanish number rules
---

## Scope and status

This note is the **engine specification**: the exact es-ES (peninsular Spanish)
grammar that the pure `engine` layer must encode for formatting numbers and for
matching a learner's answer. It doubles as the reference the unit tests are
written against.

Everything below is implemented and pinned by tests: a hand-verified fixture for
0–1000, boundary tables around every irregular form, and property tests. The
learner-facing range is
**0 to 1,000,000** plus decimals, so everything up to `un millón` must be
exact; larger magnitudes are specified for completeness and to define correct
rejections.

Conventions: pure numbers are read in the **masculine** by default
(`uno`, `doscientos`), because euros and the grocery units are masculine. Gender
agreement (`una`, `doscientas`) applies only where a feminine noun is present.

## Units and the fused ranges: 0–29

0–15 are simple words. **16–19 and 21–29 are written as one fused word** — the
old three-word forms are archaic and hard-rejected (see
[Matching](#matching-and-verdicts)).

| n | Word | | n | Word |
| --- | --- | --- | --- | --- |
| 0 | cero | | 15 | quince |
| 1 | uno | | 16 | dieciséis |
| 2 | dos | | 17 | diecisiete |
| 3 | tres | | 18 | dieciocho |
| 4 | cuatro | | 19 | diecinueve |
| 5 | cinco | | 20 | veinte |
| 6 | seis | | 21 | veintiuno |
| 7 | siete | | 22 | veintidós |
| 8 | ocho | | 23 | veintitrés |
| 9 | nueve | | 24 | veinticuatro |
| 10 | diez | | 25 | veinticinco |
| 11 | once | | 26 | veintiséis |
| 12 | doce | | 27 | veintisiete |
| 13 | trece | | 28 | veintiocho |
| 14 | catorce | | 29 | veintinueve |

Accents that carry meaning here: **dieciséis, veintidós, veintitrés,
veintiséis**. (Matching folds diacritics, so a missing accent is accepted with a
note, not counted wrong — but the canonical form keeps them.)

**Hard-rejected archaic forms** (verdict `wrong`, not a spelling slip):

| Wrong (archaic) | Correct |
| --- | --- |
| diez y seis | dieciséis |
| diez y siete | diecisiete |
| veinte y uno | veintiuno |
| veinte y dos | veintidós |

## Tens 30–99 and the one place "y" belongs

The tens words 30–90 are regular; 31–99 join tens and units with **`y`**.

| n | Ten | Example with units |
| --- | --- | --- |
| 30 | treinta | treinta y uno, treinta y cinco |
| 40 | cuarenta | cuarenta y dos |
| 50 | cincuenta | cincuenta y ocho |
| 60 | sesenta | sesenta y tres |
| 70 | setenta | setenta y nueve |
| 80 | ochenta | ochenta y cuatro |
| 90 | noventa | noventa y nueve |

### The "y" rule

`y` appears in **exactly one position**: between a tens word (30–90) and a unit
(1–9). Nowhere else.

| Boundary | `y`? | Correct | Wrong |
| --- | --- | --- | --- |
| tens 30–90 → units | **yes** | cuarenta **y** cinco | cuarenta cinco |
| 16–29 (fused) | no | veintiuno | veinte **y** uno |
| hundreds → rest | no | ciento cinco | ciento **y** cinco |
| thousands → rest | no | mil uno | mil **y** uno |
| millions → rest | no | un millón cinco | un millón **y** cinco |

So `147` is `ciento cuarenta y siete` — the only `y` sits between `cuarenta`
and `siete`.

## Hundreds: cien vs ciento, and the irregulars

| Case | Form | Examples |
| --- | --- | --- |
| exactly 100 | **cien** | cien |
| 100 as a multiplier | **cien** | cien mil (100 000), cien millones |
| 101–199 | **ciento** + rest | ciento uno, ciento cincuenta, ciento noventa y nueve |
| 200–900 | `-cientos` | see below |

The hundreds 200–900 agree in number; three are **irregular** and must be
memorised as whole words rather than derived:

| n | Word | Regular? |
| --- | --- | --- |
| 200 | doscientos | regular |
| 300 | trescientos | regular |
| 400 | cuatrocientos | regular |
| **500** | **quinientos** | **irregular** |
| 600 | seiscientos | regular |
| **700** | **setecientos** | **irregular** (not "sietecientos") |
| 800 | ochocientos | regular |
| **900** | **novecientos** | **irregular** (not "nuevecientos") |

Gender agreement when a feminine noun follows: `doscientas`, `quinientas`, etc.
(`quinientas personas`). Pure-number practice uses the masculine `-os`.

## Thousands: mil

| Rule | Correct | Wrong |
| --- | --- | --- |
| 1000 has no "un" | **mil** | un mil |
| multiples | dos mil, tres mil, cien mil, doscientos mil | — |
| `mil` is invariable | quinientos mil, cien mil | ~~miles~~ (never pluralised when counting) |
| no "y" after mil | mil cien (1100), dos mil quince (2015) | mil y cien |
| "y" still only in the tens–units slot | mil novecientos noventa y nueve (1999) | — |

Worked example — `100 000`: `cien mil`. `256 000`: `doscientos cincuenta y seis
mil`.

## Millions and the apocope of uno

Unlike `mil`, a million **takes `un`** and is a countable noun.

| n | Word |
| --- | --- |
| 1 000 000 | **un millón** |
| 2 000 000 | dos millones |
| 1 000 000 (before a noun) | un millón **de** euros |
| 5 000 000 (before a noun) | cinco millones **de** euros |

Note the accent shift: **millón** (singular, accented) → **millones** (plural,
no accent). Before a noun, `millón/millones` takes **`de`**
(`un millón de euros`).

### Apocope: uno → un

`uno` shortens to **`un`** before `mil`, before `millón/millones`, and before a
masculine noun. This also apocopates the fused/compound forms, adding an accent:

| Value | Form | Note |
| --- | --- | --- |
| 21 (standalone) | veintiuno | full form |
| 21 000 | **veintiún** mil | apocope + accent |
| 21 000 000 | veintiún millones | apocope + accent |
| 31 000 | treinta y **un** mil | apocope |
| 41 000 000 | cuarenta y **un** millones | apocope |
| 21 (before masc. noun) | veintiún euros | apocope + accent |
| 1 (before masc. noun) | un euro | apocope |
| 1 (before fem. noun) | una | agreement, no apocope |

## Beyond a million (out of range, for correct rejection)

Spain uses the **long scale**. This matters for what the engine must *reject*:

| Value | Correct (es-ES) | Hard-reject |
| --- | --- | --- |
| 10⁹ (1 000 000 000) | **mil millones** | un billón |
| 10¹² | un billón | mil millones |

`billón` is 10¹², not 10⁹ — the false-friend of English "billion". These values
sit above the v1 range, but the engine still rejects `un billón` for 10⁹ so the
rule is testable.

## Decimals

The decimal separator in es-ES is the **comma**, read as **`coma`** (neutral /
mathematical) or **`con`** (common in prices and everyday speech).

| Number | Read as | Notes |
| --- | --- | --- |
| 4,75 | cuatro **coma** setenta y cinco | mathematical style |
| 4,75 | cuatro **con** setenta y cinco | conversational / price style |
| 0,5 | cero coma cinco | leading zero spoken |
| 3,14 | tres coma catorce | fractional part read as a number… |
| 3,14 | tres coma uno cuatro | …or digit by digit — both accepted |

The integer part follows all rules above; the fractional part after `coma`/`con`
may be read as a whole number (`setenta y cinco`) or digit-by-digit
(`siete cinco`), and the matcher accepts both.

## Prices (EUR)

Euro prices have a small **accepted set** of phrasings; all map to the same
value and pass. Example: **4,75 €**.

| Phrasing | Accepted |
| --- | --- |
| cuatro euros con setenta y cinco | ✅ canonical |
| cuatro euros con setenta y cinco céntimos | ✅ |
| cuatro con setenta y cinco | ✅ (euros elided) |
| cuatro setenta y cinco | ✅ (fully elided) |
| cuatro coma setenta y cinco euros | ✅ |

Edge cases:

| Amount | Accepted forms |
| --- | --- |
| 1,00 € | un euro |
| 5,00 € | cinco euros |
| 0,75 € | setenta y cinco céntimos |
| 0,01 € | un céntimo |
| 21,00 € | veintiún euros (apocope) |
| 1 000 000,00 € | un millón de euros (note the `de`) |

## Quantities (grocery)

Everyday shop quantities mix fractions of a kilo with gram counts.

| Quantity | Spoken | Value |
| --- | --- | --- |
| ½ kg | medio kilo | 0,5 kg |
| 1½ kg | kilo y medio | 1,5 kg |
| 2½ kg | dos kilos y medio | 2,5 kg |
| ¼ kg | cuarto de kilo | 0,25 kg |
| ¾ kg | tres cuartos de kilo | 0,75 kg |
| 1 kg | un kilo | 1 kg |
| 2 kg | dos kilos | 2 kg |
| 250 g | doscientos cincuenta gramos | 250 g |
| 100 g | cien gramos | 100 g |
| 500 g | quinientos gramos | 500 g |
| ½ L | medio litro | 0,5 L |

Notes for the matcher:

- `medio` precedes the unit unchanged (`medio kilo`, `medio litro`), while
  `y medio` follows a whole unit (`kilo y medio`, `dos kilos y medio`).
- `cuarto de kilo` uses `de`; `250 gramos` is just the cardinal + unit, so it
  reuses the integer rules above (including the `quinientos` irregular for
  500 g).

## Matching and verdicts

The engine returns one of three verdicts (see [[mode-registry]] for how modes
consume them):

| Verdict | When |
| --- | --- |
| `correct` | canonical match after normalisation, or an accepted variant — which may carry a note explaining the equivalence, at no cost to the score |
| `almost` | right word, missing accent — scores 8 of 10 and keeps the combo |
| `wrong` | a real grammatical error, including hard-rejected archaisms |

Normalisation before comparison:

1. **NFD diacritic folding** — decompose and strip combining marks, so
   `dieciseis` matches `dieciséis`. A stripped accent yields `almost`,
   never `wrong`.
2. **Whitespace / case** — collapse runs of spaces, lowercase, trim.
3. **Accepted-variant sets** — each target carries the price/quantity/decimal
   phrasings above; any member matches.

Hard rejections stay `wrong` even after folding, because they are grammar, not
spelling: `veinte y uno` (→ veintiuno), `diez y seis` (→ dieciséis), a stray
`y` after hundreds/thousands (`ciento y cinco`, `mil y uno`), `un mil` (→ mil),
and `un billón` for 10⁹ (→ mil millones).

These rules are the single source of truth for the engine's tests; any change
here is an engine change and belongs in the same PR as the code.
