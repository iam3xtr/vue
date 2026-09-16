# @iam3xtr/vue

Переносимый Vue-слой для приложений 3xtr.im.

Владеет переносимыми Vue-компонентами и framework-level composables для
UI-состояний, фокуса и оверлеев. Зависит от визуального контракта
`@iam3xtr/ui` для токенов/темы/ассетов.

Не должен содержать API-клиентов, Pinia stores, RBAC, продуктовых роутов,
fixture-данных, локалей мастера, тарифной или доменной политики, либо
product-specific URL. Всё это остаётся в каждом потребляющем приложении.

## Две входные точки

```js
import { Icon, Loader, AsyncState, ListAsyncState, CopyPre, Toolbar, ToolbarDropdown,
         ToolbarSearch, MobileFilters, NavbarMenu,
         iconRegistryKey, provideIconRegistry, navbarMenuKey, useFocusTrap } from "@iam3xtr/vue";

import { PageHeader, NavbarTabs, TariffSummaryCard } from "@iam3xtr/vue/navigation";
```

- **`.` (core)** — ни один компонент/composable выше не требует ни
  смонтированного Vue Router, ни `window`/`document` во время импорта.
  Браузерная работа (слушатель `matchMedia`, глобальный обработчик
  `keydown`, `navigator.clipboard`) выполняется только внутри lifecycle
  hooks с парной очисткой, никогда на верхнем уровне module/setup.
- **`./navigation`** — `PageHeader`, `NavbarTabs` и `TariffSummaryCard`
  безусловно рендерят `RouterLink`, поэтому импорт этой входной точки
  требует установленный Vue Router. Вынесены отдельно, чтобы импорт core
  входной точки (например, в SSR-контексте без смонтированного роутера)
  никогда не тянул это требование. Ни один из трёх не хардкодит собственный
  роут потребляющего приложения — см. пропсы каждого компонента ниже.

## Подключение

```js
import { createApp } from "vue";
import Buefy from "buefy";
import "@iam3xtr/ui/styles/theme.css"; // либо .scss — см. README пакета @iam3xtr/ui

const app = createApp(App);
app.use(Buefy); // требуется один раз, самим потребляющим приложением — этот пакет сам app.use() не вызывает
app.use(router); // только если используете входную точку ./navigation
app.mount("#app");
```

Этот пакет никогда сам не вызывает `createApp`/`app.use`/`createRouter` и не
поставляет вторую копию Vue, Buefy или Vue Router — `vue`, `buefy` и
`@iam3xtr/ui` — обязательные peer-зависимости, `vue-router` — опциональная
(нужна только для `./navigation`).

## Компоненты (core)

| Компонент | Пропсы | События | Слоты | Требует |
| --- | --- | --- | --- | --- |
| `Icon` | `name` (обязателен), `size` (по умолчанию `24`) | — | — | реестр иконок (см. ниже) |
| `Loader` | `size` (`inline"\|"section"\|"screen"`, по умолчанию `"section"`), `label` (по умолчанию `"Загрузка"`) | — | — | `@iam3xtr/ui` (инлайнит его SVG-марки лоадера) |
| `AsyncState` | `variant` (обязателен, один из `loading/empty/no-results/error/permission-denied`), `icon`, `title`, `message` | — | default (действия) | Buefy (`b-icon`) при переданном `icon` |
| `ListAsyncState` | `loading`, `error`/`errorIcon`/`errorTitle`/`errorMessage`, `empty`/`emptyIcon`/`emptyTitle`/`emptyMessage`, `noResults`/`noResultsIcon`/`noResultsTitle`/`noResultsMessage` | — | default, `error-action`, `empty-action` | транзитивно Buefy через `AsyncState` |
| `CopyPre` | `text`, `buttonLabel` (по умолчанию `"Копировать"`), `copiedLabel` (по умолчанию `"Скопировано!"`), `title`, `disabled` | — | default | Buefy (`b-icon`) |
| `Toolbar` | `search`, `searchPlaceholder`, `searchAriaLabel`, `filtersActive` | `update:search`, `shortcut` | `filters`, `actions`/default | Buefy, транзитивно |
| `ToolbarDropdown` | `options` (обязателен), `allLabel` (обязателен), `ariaLabel`; `v-model` (обязателен) | `update:modelValue` | — | Buefy (`b-dropdown`) |
| `ToolbarSearch` | `placeholder` (обязателен), `ariaLabel`, `priority` (`"navbar"\|"page"`); `v-model` (обязателен) | `update:modelValue`, `shortcut` | — | Buefy (`b-input`) |
| `MobileFilters` | `active`, `triggerAriaLabel` (по умолчанию `"Открыть фильтры"`), `triggerTitle` (по умолчанию `"Фильтры"`) | — | default | Buefy (`b-dropdown`, `b-button`) |
| `NavbarMenu` | — (читает injection `navbarMenuKey`) | — | default | — |

Каждый текстовый пропс выше по умолчанию на русском — по кабинету-эталону,
из которого извлечён этот пакет; передавайте свои строки для локализации.
Полный doc-комментарий (заметки о доступности, гарантии SSR, точная
разметка) — в `.vue`-файле каждого компонента.

## Компоненты (`./navigation`)

| Компонент | Пропсы | Требует |
| --- | --- | --- |
| `PageHeader` | `title`, `subtitle`, `back` (`{ to, title? }`) | Vue Router; Buefy (`b-icon`) при переданном `back` |
| `NavbarTabs` | `items` (обязателен, `{ label, to }[]`), `ariaLabel` (по умолчанию `"Навигационные вкладки"`) | Vue Router |
| `TariffSummaryCard` | `tariff` (обязателен), `label` (по умолчанию `"Тариф"`), `to` (опционально — без него рендерится обычный `div`, с ним — `RouterLink`) | Buefy (`b-progress`); Vue Router только если передан `to` |

## Реестр иконок

`Icon` резолвит `name` против реестра, который предоставляет ваше
приложение — сам пакет не поставляет файлы иконок (набор кастомных иконок
живёт в `@iam3xtr/ui`'s `assets/icons/*`, всё остальное — обычное имя MDI
для `b-icon`, которое через `Icon` не проходит вовсе). Регистрируется один
раз, в корне приложения:

```js
import { provideIconRegistry } from "@iam3xtr/vue";
import anthropicIcon from "@iam3xtr/ui/assets/icons/anthropic.svg"; // например, через vite-svg-loader

provideIconRegistry(app, { anthropic: anthropicIcon /* , ... */ });
```

Записью реестра может быть Vue-компонент (например, из `vite-svg-loader`)
или сырая SVG-разметка строкой (например, из обычного `?raw`-импорта) —
`Icon` рендерит и то, и другое. Ничего не регистрируется как побочный
эффект импорта `Icon` или самого пакета.

## Composables

- **`useFocusTrap(containerRef, activeRef, options?)`** — focus trap +
  возврат фокуса для оверлейного UI, где хост (например, `b-dropdown`)
  ловит `Tab`, но не возвращает фокус на свой триггер при закрытии.
  `activeRef` — однонаправленное зеркало собственного open-состояния хоста;
  composable никогда не пишет в него обратно, чтобы закрыть. Убирает свой
  `document`-слушатель `keydown` в `onUnmounted`.
- **`navbarMenuKey`** — injection-ключ для Teleport-цели `NavbarMenu`.
  Application shell предоставляет его один раз
  (`app.provide(navbarMenuKey, targetRef)`) значением
  `Ref<Element | string | null>` (либо обычным элементом/селектором) — тем,
  что принимает `<Teleport :to>`.

## Контракт SSR и бандлера

- Компоненты core-входной точки не читают ни один браузерный global во
  время импорта или setup; обращение к `window`/`document`/`navigator`
  происходит только внутри `onMounted`/обработчиков событий, всегда в паре
  с очисткой в `onBeforeUnmount`/`onUnmounted`.
- Нет алиаса `@/...`, нет требования `vite-svg-loader`: `Loader` инлайнит
  свои SVG-марки из `@iam3xtr/ui` через обычный `?raw`-импорт (базовая
  возможность Vite, не плагин); `Icon` берёт свои ассеты через
  внедрённый реестр, а не импортирует что-либо сам.
- Нет второго экземпляра Vue/Buefy/Vue Router, нигде в пакете нет вызова
  `createApp`/`app.use`/`createRouter`.

## Чего здесь нет

Нет API-клиентов, Pinia stores, RBAC, fixture/демо-данных, локалей мастера
или common-адаптеров, тарифной/доменной политики или захардкоженных
продуктовых роутов — `TariffSummaryCard`, единственный компонент,
перенесённый оттуда, где раньше хардкодился один такой роут, теперь берёт
целевую ссылку как проп `to`. За этим — см. потребляющее приложение (и
`@iam3xtr/ui` для визуального контракта).

## Разработка

```bash
npm install   # подтягивает vue/buefy/vue-router как devDependencies, @iam3xtr/ui из ../ui
npm test      # компонентные, accessibility, listener-cleanup, SSR и контрактные тесты
```

## Публикация

Публикуйте этот пакет **после** того, как уже опубликован совместимый
`@iam3xtr/ui` — `peerDependencies` этого пакета закрепляют диапазон
`@iam3xtr/ui`, и публикация до того, как этот диапазон появится в registry,
оставит потребителей без возможности зарезолвить рабочую пару. Полный
релизный процесс — порядок публикации, таблица рекомендуемой пары,
тарбол/registry consumer-матрица, восстановление после partial publish и
rollback — задокументирован одним нормативным текстом в
[`docs/release-process.md`](https://github.com/iam3xtr/trickster-ui-kit/blob/main/docs/release-process.md)
в репозитории UI Kit; здесь не дублируется.

Релиз оформляется пушем тега `vX.Y.Z`, точно совпадающего с `version` из
`package.json` — [`.github/workflows/release.yml`](.github/workflows/release.yml)
затем прогоняет полный набор тестов, отказывает при несовпадении тега с
версией или уже опубликованной версии и публикует в `npm.pkg.github.com`
под GitHub `environment: release` (настройте там required reviewers, чтобы
каждую публикацию подтверждал человек). `packages:write` запрашивает только
эта джоба; [`.github/workflows/ci.yml`](.github/workflows/ci.yml), который
запускается на каждый push/PR, остаётся на `contents: read`. Оба workflow
также выкачивают `iam3xtr/ui` в соседнюю директорию `../ui` (devDependency
`@iam3xtr/ui` этого пакета — `file:../ui`, та же submodule-sibling
раскладка, что использует UI Kit), закреплённый на коммите из
`.ui-compat-ref` — это требует отдельного read-only cross-repo токена; полное
разграничение кредов и диагностика отказа доступа — в
`docs/release-process.md`, здесь не дублируется.
