# NGEN SG Connect product diagram

Responsive React + TypeScript implementation of the [NGEN Figma design](https://www.figma.com/design/VWjclS7vZ6lhThOO3c38Ta/N-GEN?node-id=1-3).

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173).

```sh
npm run build
npm run preview
npm test
```

The production site is in `dist/`, including all artwork and font files. Browser tests use installed Google Chrome; to use Playwright's Chromium instead, remove `channel: 'chrome'` from `playwright.config.ts` and run `npx playwright install chromium`.

## Canvas controls

- Drag the background or a card to move around.
- Two-finger trackpad scrolling pans in any direction, and trackpad pinch zooms around the gesture. Ctrl / Command + scroll and touch pinch also zoom. Shift + vertical scroll pans horizontally.
- Zoom from 5% to 200% using the + / − buttons; click the percentage for 100%, or press 0 while the canvas is focused to see everything.
- Focus the canvas and use arrow keys to pan, + / − to zoom, or 0 to fit. Shift + arrow moves farther.
- Use the Fullscreen button at the top right to expand the canvas. Click it again or press Escape to exit. Embedded previews without fullscreen permission expand within the browser.
- Hover or focus a question mark for details. Tap it to keep the tooltip open while panning; tap again, click outside the canvas, or press Escape to dismiss.
- The Explore buttons retain the designed styling and animations, without pop-ups.

## Design and integration

The module preserves the Development annotations: 24px outer spacing on desktop, a gray canvas occupying the remaining viewport, proportional scaling of the entire diagram, white / green / dark node variants, rearranged text when there is no CTA, and the same Motion timing and easing for tooltip entry and exit. Narrow screens use 16px spacing and a stacked heading.

Source frames: module `6224:24416`, canvas `6225:24706`, node variants `6225:24558`, and tooltip `6335:24637`. Static layers retain the complete Figma connector geometry and all 26 original artwork / SVG assets. The updated canvas includes the pale green SG Connect region, its vector logo, the dashed “AT YOUR SITE” boundary, and the repositioned Weather and Prices tags with shortened arrows. They are rendered as elements, never as a canvas screenshot.

- `src/App.tsx`: module, controls, and node tooltips.
- `src/useFullscreen.ts`: native full-screen mode and an embedded-preview fallback.
- `src/useCanvas.ts`: pan, pinch, pointer-centred zoom, fit, keyboard and resize handling. Motion values keep frame-by-frame camera updates outside React's rendering cycle.
- `src/DiagramNode.tsx`: reusable node variants and app card.
- `src/data.ts`: node content, positions, crop settings, and CTA labels.
- `src/DesignLayers.tsx` + `src/design-layers.css`: fixed artwork, connectors, and labels.
- `src/styles.css`: responsive layout, design tokens, and local fonts.

Figma supplied no CTA destination URLs, and the tooltip design contains placeholder prose. The Explore buttons are intentionally unwired. To connect your own pages, provide an action handler in `DiagramNode.tsx`; edit `detail` in `data.ts` for approved tooltip copy.

Tooltips open 12 canvas pixels to the right of their nodes, align with their top edges, and scale with the diagram. They stay in the canvas and never flip to the left or overlap the node to fit the viewport. Pan or zoom to bring a tooltip into view. The drag-to-pan text remains visible on desktop and mobile. The module controls match the updated Figma design: a white Fullscreen pill at the top right, and a right-aligned 12px gray Inter percentage followed by separate 32px white − and + buttons with a 2px gap at the bottom right. Reduced-motion preferences disable canvas transitions and are respected by Motion.

Fonts are copied locally from the supplied Inter Variable and Geist Mono SemiBold files. The root uses `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale` for lighter macOS browser rendering while preserving the Figma font weights. Synthetic bold and italic remain disabled with `font-synthesis: none`. The Material Symbols Rounded glyphs used in the design are also bundled locally. No runtime font service or temporary Figma asset URL is used.

Tooltip entry and exit animate opacity and top position with Motion, without a nested scale transform. The solid white tooltip has no backdrop filter, keeping hover from introducing an offscreen blur surface into the scaled scene. Browser regression checks compare node title and description screenshots before and during tooltip hover at 200%.

Animations use [Motion for React](https://motion.dev/docs/react-installation). Fullscreen uses a slightly overdamped spring to animate the canvas bounds and corner radius from its position in the module. The diagram keeps its zoom and proportions while the available viewing area expands. Exit reverses the transition, including Escape and interrupted animations. The native fullscreen host is the module, so the canvas can animate inside it; embedded previews use the same transition. Reduced-motion preferences make the bounds change immediately.

The diagram uses one uniform transform scale, including all typography, cards, artwork, and tooltips. Native CSS `zoom` is avoided because browser minimum font sizes can make small text stop shrinking while the cards continue shrinking. Text resizing is disabled inside the scene to preserve the designed proportions.

Trackpad input is accumulated into one camera target and rendered once per animation frame through Motion values. A short 28ms exponential filter smooths timing gaps without overshoot, extra inertia, or dropped fractional deltas. Panning travels 15% farther per scroll distance; wheel pinch / modifier zoom sensitivity is 50% faster than the original implementation. The operating system supplies the momentum tail. Pixel, line, and page wheel deltas are normalized, and Safari native gesture events are supported alongside Ctrl-wheel pinch. Input also works over tooltips and module controls. Direct dragging or a new button / keyboard action cancels the pending wheel target. Reduced motion applies the complete target on the next frame.

The zoom renderer has no permanent `will-change: transform` or forced 3D layer, allowing text and SVG connectors to be painted at the current scale rather than enlarging a cached bitmap. This follows [Chrome's rendering guidance](https://developer.chrome.com/blog/re-rastering-composite). Pan and scale update through Motion values; only the zoom controls subscribe to percentage changes. Decorative layers are memoized, and layout and paint are contained within the visible viewport.

The original 3D illustrations are raster image fills in Figma, mostly 4096px wide. They retain their original resolution and crops. The app icon source is only 212 × 206px and can soften when enlarged; a vector or higher-resolution source is needed to improve it without changing the artwork. Text, node geometry, icons, and SVG connectors remain resolution-independent. Regression checks compare every element's proportions at 5%, 25%, 100%, 150%, and 200% on desktop and mobile.
