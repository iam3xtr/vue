# @iam3xtr/vue

Переносимый Vue-слой для приложений 3xtr.im.

Владеет переносимыми Vue-компонентами и framework-level composables для
UI-состояний, фокуса и оверлеев. Зависит от визуального контракта
`@iam3xtr/ui` для токенов/темы/ассетов.

Не должен содержать API-клиентов, Pinia stores, RBAC, продуктовых роутов,
fixture-данных, локалей мастера, тарифной или доменной политики, либо
product-specific URL. Всё это остаётся в каждом потребляющем приложении.

## Три входные точки

```js
import { Icon, Loader, AsyncState, ListAsyncState, CopyPre, Toolbar, ToolbarDropdown,
         ToolbarSearch, MobileFilters, NavbarMenu, FileDropTarget, FormDrawer,
         iconRegistryKey, provideIconRegistry, navbarMenuKey, useFocusTrap } from "@iam3xtr/vue";

import { PageHeader, NavbarTabs, TariffSummaryCard } from "@iam3xtr/vue/navigation";

import { trVue } from "@iam3xtr/vue/plugin";
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
- **`./plugin`** — `trVue`, `app.use()`-плагин, регистрирующий все
  публичные компоненты обеих точек выше как глобальные `tr-*` (см. "Плагин
  `trVue`" ниже). Как и `./navigation`, требует установленный Vue Router;
  ни `.`, ни `./navigation` не импортируют этот модуль, так что именованные
  импорты из них продолжают не требовать Vue Router независимо от того,
  используется ли где-то в приложении `trVue`.

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

## Плагин `trVue`

Отдельная третья входная точка, `@iam3xtr/vue/plugin` — один документированный
способ подключить весь публичный пакет (core + `./navigation`) сразу, для
приложений, которым не важен bundle-контроль по отдельным компонентам.
Именованные импорты из `.` и `./navigation` остаются нетронутой
bundle-sensitive альтернативой: ни один из этих двух входов не импортирует
`./plugin.js`, так что использование `trVue` где-то в приложении не тянет
Vue Router в граф импортов кода, который продолжает делать только именованные
импорты.

```js
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import Buefy from "buefy";
import { trVue } from "@iam3xtr/vue/plugin";
import "@iam3xtr/ui/styles/theme.css"; // либо .scss — см. README пакета @iam3xtr/ui

const router = createRouter({ history: createWebHistory(), routes });

const app = createApp(App);
app.use(router); // до trVue — trVue регистрирует PageHeader/NavbarTabs/TariffSummaryCard
app.use(Buefy); // до trVue — этот пакет сам Buefy не регистрирует
app.use(trVue); // порядок обязателен: Router -> Buefy -> trVue
app.mount("#app");
```

`app.use(trVue)` регистрирует каждый публичный core- и
navigation-компонент как глобальный, под фиксированным `tr-*` именем:

| Глобальное имя | Компонент |
| --- | --- |
| `tr-icon` | `Icon` |
| `tr-loader` | `Loader` |
| `tr-async-state` | `AsyncState` |
| `tr-list-async-state` | `ListAsyncState` |
| `tr-copy-pre` | `CopyPre` |
| `tr-toolbar` | `Toolbar` |
| `tr-toolbar-dropdown` | `ToolbarDropdown` |
| `tr-toolbar-search` | `ToolbarSearch` |
| `tr-mobile-filters` | `MobileFilters` |
| `tr-navbar-menu` | `NavbarMenu` |
| `tr-file-drop-target` | `FileDropTarget` |
| `tr-form-drawer` | `FormDrawer` |
| `tr-page-header` | `PageHeader` (`./navigation`) |
| `tr-navbar-tabs` | `NavbarTabs` (`./navigation`) |
| `tr-tariff-summary-card` | `TariffSummaryCard` (`./navigation`) |

Этот же список экспортирован как `trVueComponents` из `@iam3xtr/vue/plugin`
для программной проверки, а не только для README.

`app.use(trVue)` идемпотентен — повторный вызов на том же `app` (например, из
переиспользуемого setup-хелпера, вызванного дважды) не переустанавливает
компоненты и не выдаёт предупреждение Vue "already been registered". Плагин
сам никогда не вызывает `app.use()`/`createRouter()`, не регистрирует Buefy
и не импортирует тему `@iam3xtr/ui` — все три шага выше остаются за
потребителем, до `app.use(trVue)`.

Глобальное имя `tr-icon` регистрирует сам компонент `Icon`, а не данные —
инъекция дополнительного реестра иконок (`provideIconRegistry`) остаётся
отдельным шагом и не входит в `trVue`. `Icon` уже несёт `@iam3xtr/ui`'s
default-реестр без этого шага (см. "Реестр иконок" ниже); `provideIconRegistry`
нужен только чтобы что-то добавить/переопределить сверху.

## Компоненты (core)

| Компонент | Пропсы | События | Слоты | Требует |
| --- | --- | --- | --- | --- |
| `Icon` | `name` (legacy), `icon` (Buefy-совместимый алиас `name`), `size` (по умолчанию `24`) | — | default (высший приоритет — см. ниже) | `@iam3xtr/ui` (встроенный default-реестр); Buefy (`b-icon`) опционально как MDI fallback |
| `Loader` | `size` (`inline"\|"section"\|"screen"`, по умолчанию `"section"`), `label` (по умолчанию `"Загрузка"`) | — | — | `@iam3xtr/ui` (инлайнит его SVG-марки лоадера) |
| `AsyncState` | `variant` (обязателен, один из `loading/empty/no-results/error/permission-denied`), `icon`, `title`, `message` | — | default (действия) | Buefy (`b-icon`) при переданном `icon` |
| `ListAsyncState` | `loading`, `error`/`errorIcon`/`errorTitle`/`errorMessage`, `empty`/`emptyIcon`/`emptyTitle`/`emptyMessage`, `noResults`/`noResultsIcon`/`noResultsTitle`/`noResultsMessage` | — | default, `error-action`, `empty-action` | транзитивно Buefy через `AsyncState` |
| `CopyPre` | `text`, `buttonLabel` (по умолчанию `"Копировать"`), `copiedLabel` (по умолчанию `"Скопировано!"`), `title`, `disabled` | — | default | Buefy (`b-icon`) |
| `Toolbar` | `search`, `searchPlaceholder`, `searchAriaLabel`, `filtersActive` | `update:search`, `shortcut` | `filters`, `actions`/default | Buefy, транзитивно |
| `ToolbarDropdown` | `options` (обязателен), `allLabel` (обязателен), `ariaLabel`; `v-model` (обязателен) | `update:modelValue` | — | Buefy (`b-dropdown`) |
| `ToolbarSearch` | `placeholder` (обязателен), `ariaLabel`, `priority` (`"navbar"\|"page"`); `v-model` (обязателен) | `update:modelValue`, `shortcut` | — | Buefy (`b-input`) |
| `MobileFilters` | `active`, `triggerAriaLabel` (по умолчанию `"Открыть фильтры"`), `triggerTitle` (по умолчанию `"Фильтры"`) | — | default | Buefy (`b-dropdown`, `b-button`) |
| `NavbarMenu` | — (читает injection `navbarMenuKey`) | — | default | — |
| `FileDropTarget` | `disabled`, `multiple` (по умолчанию `true`), `accept` (расширения/MIME/`image/*`, только клиентская подсказка), `overlayLabel` (по умолчанию `"Отпустите файлы, чтобы загрузить"`) | `files` (`File[]`, только на реальном drop файлов) | default | — |
| `FormDrawer` | `v-model` (обязателен, open state), `title`, `busy`, `disabled`, `closeAriaLabel` (по умолчанию `"Закрыть"`) | `update:modelValue`, `submit` (не эмитится во время `busy`/`disabled`) | default (form body, scoped `{ busy, disabled }`), `footer` (actions, тот же scope) | Buefy (`b-sidebar`, `b-icon`) |

Каждый текстовый пропс выше по умолчанию на русском — по кабинету-эталону,
из которого извлечён этот пакет; передавайте свои строки для локализации.
Полный doc-комментарий (заметки о доступности, гарантии SSR, точная
разметка) — в `.vue`-файле каждого компонента.

Для `AsyncState` с `variant="loading"` `title`/`message` не рендерятся как
видимый текст рядом со спиннером — вместо этого они передаются во внутренний
`Loader` как `label` (только accessible name): `title` в приоритете,
`message` — fallback, а без обоих сохраняется документированный default
`Loader`. Передавайте переведённые строки — компонент не вводит собственную
package locale.

`FileDropTarget` — переносимая drop-поверхность над произвольным
интерактивным slot-содержимым (например, `b-table`): семантически
нейтральный `div`, без скрытого `<input type="file">` и без picker — обычный
click/focus/сортировка/dropdown дочернего контента не блокируются. Оверлей
монтируется только во время реального drag файлов (`v-if`, не
`visibility`/`opacity`) и невидим для указателя (`pointer-events: none` в
теме `@iam3xtr/ui`), поэтому drag-события продолжают приходить на реальные
вложенные узлы, а не на сам оверлей — это и удерживает его от мерцания при
переходах между дочерними элементами. `accept` — только клиентская подсказка
(как у native `<input accept>`), не security boundary; компонент не знает про
upload, progress, retry, cancel или API — эмитит один `files` `File[]` и
больше ничего не делает.

`FormDrawer` — единый каркас правой формы поверх штатного `b-sidebar`
(`right`, `overlay`, `fullheight`), а не самодельный overlay: Escape, клик
по backdrop и scroll lock остаются контрактом Buefy. Header содержит
`title` и доступную close-кнопку (`closeAriaLabel`); default slot — form
body, который скроллится независимо; `footer` slot — действия, остающиеся
видимыми под длинным body. Native `<form>` submit эмитит `submit` не более
одного раза за клик/Enter и не эмитит его вовсе, пока `busy` или `disabled`
— компонент не делает `preventDefault`-валидацию, не читает `FormData` и не
знает про draft/API. Оба slot получают `busy`/`disabled` scoped-пропами для
удобной привязки состояния кнопки в `footer`. Явное ограничение Buefy:
`b-sidebar`, в отличие от `b-modal`, не реализует focus trap и возврат
фокуса на triggering элемент при закрытии — `FormDrawer` не подменяет это
собственной реализацией; консьюмеру, которому нужен focus trap/return для
конкретного экрана, доступен `useFocusTrap` из этого же пакета.

Правило применения (эталон — kit `/kit/dialogs-overlays`): `FormDrawer` —
только для редактирования в правой панели с длинным body и fixed footer.
Прямой Buefy `b-sidebar` остаётся для неформовых панелей (свойства,
details), не для форм. `b-modal` — короткая форма без длинного body и без
выделенного fixed footer. `b-dialog` — только подтверждение действия, не
форма любой длины. `FormDrawer` не заменяет ни один из этих трёх.

## Компоненты (`./navigation`)

| Компонент | Пропсы | Требует |
| --- | --- | --- |
| `PageHeader` | `title`, `subtitle`, `back` (`{ to, title? }`) | Vue Router; Buefy (`b-icon`) при переданном `back` |
| `NavbarTabs` | `items` (обязателен, `{ label, to }[]`), `ariaLabel` (по умолчанию `"Навигационные вкладки"`) | Vue Router |
| `TariffSummaryCard` | `tariff` (обязателен), `label` (по умолчанию `"Тариф"`), `to` (опционально — без него рендерится обычный `div`, с ним — `RouterLink`) | Buefy (`b-progress`); Vue Router только если передан `to` |

## Реестр иконок

`Icon` — независимый SVG-first адаптер с опциональным Buefy/MDI fallback.
Порядок резолва для `name`/`icon` (первое совпадение выигрывает):

1. **Непустой default slot** — полный escape hatch, любая разметка
   (сторонний icon-компонент, `<b-icon alias="...">`, обычный текст).
   `name`/`icon` при этом игнорируются, и, если они всё же переданы, в
   консоль летит `console.warn` о конфликте.
2. **`name`/`icon` в реестре потребителя** — из `provideIconRegistry`,
   если он вызывался (см. ниже) — override/addition к шагу 3.
3. **`name`/`icon` в default-реестре `@iam3xtr/ui`** (`@iam3xtr/ui/icons`) —
   доступен всегда, без единого вызова `provideIconRegistry`. SVG на шаге
   2 или 3 выигрывает у шага 4 даже при одноимённом MDI-имени.
4. **`name`/`icon` как MDI-имя через глобально зарегистрированный
   `BIcon`** (`app.use(Buefy)`) — читается из реестра компонентов текущего
   приложения в момент рендера, никогда через статический
   `import ... from "buefy"`. Без установленного Buefy этот шаг просто
   пропускается; обычный `<b-icon>` в остальной разметке приложения этим
   компонентом никак не затрагивается.
5. `aria-hidden`-placeholder заданного размера.

`name` (legacy) и `icon` (Buefy-совместимый алиас того же входа) — синонимы,
передавайте тот, что читается лучше в месте вызова; при разных значениях
обоих побеждает `name` (и в консоль летит `console.warn`).

`provideIconRegistry` **не заменяет** `@iam3xtr/ui`'s default-реестр — только
добавляет к нему или переопределяет отдельные записи, поэтому вызывать его
нужно лишь для собственных иконок приложения или чтобы заменить одну из
default-записей другим представлением (например, Vue-компонентом вместо
сырой разметки):

```js
import { provideIconRegistry } from "@iam3xtr/vue";
import anthropicIcon from "@iam3xtr/ui/assets/icons/anthropic.svg"; // например, через vite-svg-loader

// Переопределяет "anthropic" из @iam3xtr/ui/icons этим Vue-компонентом;
// остальные 25 default-иконок продолжают резолвиться как раньше без этого
// вызова вовсе.
provideIconRegistry(app, { anthropic: anthropicIcon /* , ... */ });
```

Записью реестра может быть Vue-компонент (например, из `vite-svg-loader`)
или сырая SVG-разметка строкой (например, из обычного `?raw`-импорта, либо
как есть из `@iam3xtr/ui/icons`) — `Icon` рендерит и то, и другое.
`provideIconRegistry` — единственный побочный эффект в этом контракте
(`app.provide`, один раз, в корне приложения); импорт `Icon` или самого
пакета сам по себе ничего не регистрирует и не мутирует.

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
  возможность Vite, не плагин); `Icon` берёт свой default-реестр из
  `@iam3xtr/ui/icons` (обычный named-импорт JS-модуля — ни `import.meta.glob`,
  ни бандлер-специфичный синтаксис) и опциональные добавления — через
  внедрённый `provideIconRegistry` реестр. Buefy-fallback `Icon` читает
  `BIcon` из реестра компонентов текущего приложения в момент рендера —
  нет статического `import ... from "buefy"`, поэтому прямой импорт `Icon`
  работает без установленного Buefy.
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
