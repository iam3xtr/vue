# @iam3xtr/vue

Reusable Vue layer for 3xtr.im applications.

Owns portable Vue components and framework-level composables for UI state, focus
management, and overlays. It depends on the visual contract from `@iam3xtr/ui` for
tokens/theme/assets.

It must not contain API clients, Pinia stores, RBAC, product routes, fixture data,
wizard locales, tariff or domain policy, or product-specific URLs. Those remain in each
consuming application.

## Two entry points

```js
import { Icon, Loader, AsyncState, ListAsyncState, CopyPre, Toolbar, ToolbarDropdown,
         ToolbarSearch, MobileFilters, NavbarMenu,
         iconRegistryKey, provideIconRegistry, navbarMenuKey, useFocusTrap } from "@iam3xtr/vue";

import { PageHeader, NavbarTabs, TariffSummaryCard } from "@iam3xtr/vue/navigation";
```

- **`.` (core)** — every component and composable above needs neither a mounted Vue
  Router nor `window`/`document` at import time. Browser-only work (a `matchMedia`
  listener, a global `keydown` handler, `navigator.clipboard`) happens inside lifecycle
  hooks with matching cleanup, never at module/setup top level.
- **`./navigation`** — `PageHeader`, `NavbarTabs` and `TariffSummaryCard` each render a
  `RouterLink` unconditionally, so importing this entry point requires Vue Router
  installed. Kept separate so importing the core entry point (e.g. in an SSR context
  with no router mounted yet) never pulls that requirement in. None of the three
  hardcodes a consuming application's own route — see each component's props below.

## Setup

```js
import { createApp } from "vue";
import Buefy from "buefy";
import "@iam3xtr/ui/styles/theme.css"; // or .scss — see @iam3xtr/ui's README

const app = createApp(App);
app.use(Buefy); // required once, by the consuming application — this package never calls app.use() itself
app.use(router); // only if you use the ./navigation entry point
app.mount("#app");
```

This package never calls `createApp`/`app.use`/`createRouter` itself and ships no
second copy of Vue, Buefy or Vue Router — `vue`, `buefy` and `@iam3xtr/ui` are required
peer dependencies, `vue-router` an optional one (needed only for `./navigation`).

## Components (core)

| Component | Props | Events | Slots | Needs |
| --- | --- | --- | --- | --- |
| `Icon` | `name` (required), `size` (default `24`) | — | — | icon registry (see below) |
| `Loader` | `size` (`inline"\|"section"\|"screen"`, default `"section"`), `label` (default `"Загрузка"`) | — | — | `@iam3xtr/ui` (inlines its loader-mark SVGs) |
| `AsyncState` | `variant` (required, one of `loading/empty/no-results/error/permission-denied`), `icon`, `title`, `message` | — | default (actions) | Buefy (`b-icon`) when `icon` passed |
| `ListAsyncState` | `loading`, `error`/`errorIcon`/`errorTitle`/`errorMessage`, `empty`/`emptyIcon`/`emptyTitle`/`emptyMessage`, `noResults`/`noResultsIcon`/`noResultsTitle`/`noResultsMessage` | — | default, `error-action`, `empty-action` | transitively Buefy via `AsyncState` |
| `CopyPre` | `text`, `buttonLabel` (default `"Копировать"`), `copiedLabel` (default `"Скопировано!"`), `title`, `disabled` | — | default | Buefy (`b-icon`) |
| `Toolbar` | `search`, `searchPlaceholder`, `searchAriaLabel`, `filtersActive` | `update:search`, `shortcut` | `filters`, `actions`/default | Buefy, transitively |
| `ToolbarDropdown` | `options` (required), `allLabel` (required), `ariaLabel`; `v-model` (required) | `update:modelValue` | — | Buefy (`b-dropdown`) |
| `ToolbarSearch` | `placeholder` (required), `ariaLabel`, `priority` (`"navbar"\|"page"`); `v-model` (required) | `update:modelValue`, `shortcut` | — | Buefy (`b-input`) |
| `MobileFilters` | `active`, `triggerAriaLabel` (default `"Открыть фильтры"`), `triggerTitle` (default `"Фильтры"`) | — | default | Buefy (`b-dropdown`, `b-button`) |
| `NavbarMenu` | — (reads `navbarMenuKey` injection) | — | default | — |

Every text-bearing prop above defaults to Russian to match the reference kit this
package was extracted from; pass your own strings to localize. See each component's
`.vue` file for the full doc comment (accessibility notes, SSR guarantees, exact
markup).

## Components (`./navigation`)

| Component | Props | Needs |
| --- | --- | --- |
| `PageHeader` | `title`, `subtitle`, `back` (`{ to, title? }`) | Vue Router; Buefy (`b-icon`) when `back` passed |
| `NavbarTabs` | `items` (required, `{ label, to }[]`), `ariaLabel` (default `"Навигационные вкладки"`) | Vue Router |
| `TariffSummaryCard` | `tariff` (required), `label` (default `"Тариф"`), `to` (optional — renders a plain `div` when omitted, a `RouterLink` to it otherwise) | Buefy (`b-progress`); Vue Router only when `to` is passed |

## Icon registry

`Icon` resolves a `name` against a registry your application provides — this package
ships no icon files itself (the custom-icon set lives in `@iam3xtr/ui`'s `assets/icons/*`,
and everything else is a plain `b-icon` MDI name that does not go through `Icon` at
all). Register once, at the app root:

```js
import { provideIconRegistry } from "@iam3xtr/vue";
import anthropicIcon from "@iam3xtr/ui/assets/icons/anthropic.svg"; // via vite-svg-loader, e.g.

provideIconRegistry(app, { anthropic: anthropicIcon /* , ... */ });
```

A registry entry may be a Vue component (e.g. from `vite-svg-loader`) or a raw SVG
markup string (e.g. from a plain `?raw` import) — `Icon` renders either. Nothing is
registered as a side effect of importing `Icon` or this package.

## Composables

- **`useFocusTrap(containerRef, activeRef, options?)`** — focus trap + focus-return for
  overlay-style UI where the host (e.g. a `b-dropdown`) traps `Tab` but does not return
  focus to its trigger on close. `activeRef` is a one-way mirror of the host's own open
  state; the composable never writes back to close it. Cleans up its `document` keydown
  listener in `onUnmounted`.
- **`navbarMenuKey`** — injection key for `NavbarMenu`'s Teleport target. The
  application shell provides it once (`app.provide(navbarMenuKey, targetRef)`) with a
  `Ref<Element | string | null>` (or a plain element/selector), matching what
  `<Teleport :to>` accepts.

## SSR and bundler contract

- Core-entry components read no browser global at import or setup time; `window`/
  `document`/`navigator` access happens only inside `onMounted`/event handlers, always
  paired with matching cleanup in `onBeforeUnmount`/`onUnmounted`.
- No `@/...` path alias, no `vite-svg-loader` requirement: `Loader` inlines its
  `@iam3xtr/ui` SVG marks via a plain `?raw` import (a Vite core feature, not a plugin);
  `Icon` takes its assets through the injected registry instead of importing any itself.
- No second Vue/Buefy/Vue Router instance, no `createApp`/`app.use`/`createRouter` call
  anywhere in this package.

## What's not here

No API clients, Pinia stores, RBAC, fixture/demo data, wizard or common-adapter
locales, tariff/domain policy, or hardcoded product routes — `TariffSummaryCard`, the
one component ported from a place that used to hardcode one, now takes its link target
as a `to` prop instead. See the consuming application (and `@iam3xtr/ui` for the visual
contract) for those.

## Development

```bash
npm install   # pulls vue/buefy/vue-router as devDependencies, @iam3xtr/ui from ../ui
npm test      # component, accessibility, listener-cleanup, SSR and contract tests
```

## Releasing

Publish this package **after** a compatible `@iam3xtr/ui` is already
published — this package's `peerDependencies` pin an `@iam3xtr/ui` range,
and installing it before that range exists on the registry leaves consumers
unable to resolve a working pair. See
[`packages/consumers/README.md`](https://github.com/iam3xtr/trickster-ui-kit/blob/main/packages/consumers/README.md)
in the UI Kit repo for the recommended-pair matrix, the tarball/registry
consumer test matrix, and the partial-publish/rollback procedure.

A release is cut by pushing a tag `vX.Y.Z` matching `package.json`'s
`version` exactly — [`.github/workflows/release.yml`](.github/workflows/release.yml)
then runs the full test suite, refuses a tag/version mismatch or an
already-published version, and publishes to `npm.pkg.github.com` under a
GitHub `environment: release` (configure required reviewers there so a human
approves every publish). `packages:write` is requested only by that one job;
[`.github/workflows/ci.yml`](.github/workflows/ci.yml), which runs on every
push/PR, stays `contents: read`. Both workflows also check out `iam3xtr/ui`
into a sibling `../ui` directory (this package's `@iam3xtr/ui` devDependency
is `file:../ui`, the same submodule-sibling layout the UI Kit uses), which
needs its own read-only cross-repo token — see `packages/consumers/README.md`'s
"CI, release workflow and credentials" section in the UI Kit repo for full
credential scoping and denied-access diagnostics, not duplicated here.
