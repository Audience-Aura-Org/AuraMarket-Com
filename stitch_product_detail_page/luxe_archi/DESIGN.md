# Design System Specification: The High-End Editorial

## 1. Overview & Creative North Star

**Creative North Star: The Digital Curator**
This design system is built to transform the standard e-commerce grid into a curated, gallery-like experience. We are moving away from "utilitarian retail" and toward "editorial storytelling." The system prioritizes the product as art, utilizing intentional asymmetry, expansive white space, and a high-contrast typographic scale to guide the eye through a narrative rather than a catalog. 

By leveraging a sophisticated neutral palette against a bold, singular primary accent, we create an environment where the interface recedes to let the product shine, yet remains undeniably premium through its structural precision and layered depth.

---

## 2. Colors

The color strategy revolves around a high-end "monochrome plus" approach. Neutral grays provide the architectural foundation, while a singular primary black/accent provides the rhythmic "punctuation" throughout the layout.

### The "No-Line" Rule
To maintain a high-fashion, premium aesthetic, **the use of 1px solid borders for sectioning is strictly prohibited.** Boundaries between sections or content blocks must be established through:
- **Background Color Shifts:** Moving from `surface` to `surface-container-low`.
- **Negative Space:** Using the spacing scale to create clear mental models of separation.
- **Tonal Transitions:** Subtle shifts in container hierarchy.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine, heavy-stock paper. 
- **Base Layer:** `surface` (#f7f9fb)
- **Nested Content:** Use `surface-container-low` (#f2f4f6) for large structural areas.
- **Interactive Elements:** Use `surface-container-lowest` (#ffffff) for cards and modals to create a soft, natural "lift."
- **Focus Areas:** Use `surface-container-highest` (#e0e3e5) for sidebars or utility panels to create grounding.

### The Glass & Gradient Rule
For floating elements (navigation bars, quick-buy drawers), use semi-transparent `surface` colors with a 20px-30px `backdrop-blur`. This "Glassmorphism" prevents the UI from feeling "pasted on" and instead integrates it into the product photography.

### Signature Textures
Main CTAs and Hero sections should avoid flat color. Apply a subtle linear gradient from `primary` (#000000) to `primary_container` (#1c1b1b) at a 135-degree angle. This adds "visual soul" and mimics the way light hits premium physical materials.

---

## 3. Typography

The typography scale is a dialogue between two distinct voices: the authoritative **Manrope** for display/headlines and the functional, clean **Inter** for information.

*   **Display (Manrope):** Large, dramatic scales (`display-lg` at 3.5rem). These should be used with tight letter-spacing (-0.02em) to create a "locked" editorial feel. Use these for product names and hero statements.
*   **Headlines (Manrope):** Used to introduce new chapters of the page. They convey brand confidence.
*   **Body (Inter):** Optimized for readability. Use `body-lg` (1rem) for product descriptions to ensure a premium, easy-to-read experience. 
*   **Labels (Inter):** Used for metadata (e.g., SKU, Category). Always set these in `label-md` or `label-sm` to maintain a clear distinction from actionable text.

The hierarchy is driven by contrast. A `display-lg` headline should often be paired with a `body-md` description to create a "Big/Small" dynamic that feels intentionally designed.

---

## 4. Elevation & Depth

We convey importance through **Tonal Layering** rather than traditional drop shadows.

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card directly on a `surface-container-low` (#f2f4f6) background. This creates a sophisticated, "near-field" depth.
*   **Ambient Shadows:** For high-elevation elements (modals, dropdowns), use "Airy Shadows." 
    *   **Blur:** 40px - 60px.
    *   **Opacity:** 4% - 6% of `on-surface`.
    *   **Color:** Tint the shadow with a hint of the background color to make it feel natural, not muddy.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` (#c6c6cd) at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** Use `surface_variant` at 70% opacity with a `backdrop-filter: blur(12px)` for sticky headers. This allows product colors to bleed through, maintaining a cohesive vibe as the user scrolls.

---

## 5. Components

### Buttons
*   **Primary:** `primary` (#000000) background, `on_primary` (#ffffff) text. Use `lg` (0.5rem) roundedness. Padding: `1rem 2.5rem`.
*   **Secondary:** `secondary` (#0051d5) background. Use only for "Success" paths or secondary calls to action.
*   **Tertiary:** No background. Underline using a 1px `primary` line with a 4px offset.

### Chips (Filters & Categories)
*   **Unselected:** `surface-container-high` (#e6e8ea) with `on_surface_variant`.
*   **Selected:** `primary` (#000000) with `on_primary`. 
*   Forbid sharp corners; use the `full` (9999px) roundedness for a modern, tactile feel.

### Input Fields
*   **Style:** Minimalist. No background color. Only a bottom border using `outline-variant` (#c6c6cd). 
*   **Focus State:** The bottom border transforms into a 2px `secondary` (#0051d5) line.
*   **Error:** Use `error` (#ba1a1a) for the text and bottom border.

### Cards & Lists
*   **Card Structure:** Absolutely no dividers. Use `surface-container-lowest` as the card base. 
*   **Spacing:** Use "generous breathing room" (at least 32px padding). 
*   **Lists:** Separate items with vertical white space (e.g., 24px) instead of lines. This prevents the "spreadsheet" look and maintains the editorial flow.

### Tooltips
*   Use `inverse_surface` (#2d3133) with `inverse_on_surface` text. Apply `sm` (0.125rem) roundedness for a sharp, precise look.

---

## 6. Do's and Don'ts

### Do:
*   **Embrace Asymmetry:** Place a product image slightly off-center to create visual tension and interest.
*   **Prioritize Spacing:** If a section feels "busy," increase the vertical white space by 2x before trying to remove elements.
*   **Use Tonal Depth:** Always check if a background color shift can replace a border.

### Don't:
*   **No High-Contrast Borders:** Never use `outline` at 100% opacity for boxes. It breaks the "luxury" illusion.
*   **No Standard Drop Shadows:** Avoid the "fuzzy black" shadow. It looks dated and cheap.
*   **Don't Crowd the Content:** Premium design is defined by what you leave out. If an element isn't adding to the story, delete it.
*   **No Generic Grids:** Avoid the "3-column card row" everywhere. Vary the sizes of product showcases to create a "rhythm" (e.g., one large feature image followed by two smaller ones).