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
         ModelSelect, ChatHistory, MessageComposer,
         iconRegistryKey, provideIconRegistry, navbarMenuKey, useFocusTrap,
         useDropdownOverlay, resolveDropdownPlacement, POSITIONS,
         DROPDOWN_OVERLAY_MARKER } from "@iam3xtr/vue";

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
| `tr-model-select` | `ModelSelect` |
| `tr-chat-history` | `ChatHistory` |
| `tr-message-composer` | `MessageComposer` |
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
| `ModelSelect` | `mode` (`"model"` / `"byok"` / `"both"`), `models` (обязателен, `[{id,name,provider?}]`), `recommendedModels`, `searchResults`, `loading`, `error`, `invalid`, `disabled`, `inputId`, `triggerPlaceholder`, `searchPlaceholder`, `triggerAriaLabel`, `searchAriaLabel`, `triggerTitle`, `emptyLabel`, `loadingLabel`, `errorLabel`, `switchLabel` / `switchAriaLabel` (только `mode === "both"`), `freeformActionLabel` / `freeformActionAriaLabel` / `freeformHint` / `freeformErrorLabel` (BYOK scope); `v-model:modelId`, `v-model:byokModelId`, `v-model:providerModelId`, `v-model:useOwnApiKey` (только `mode === "both"`) | `update:modelId`, `update:byokModelId`, `update:providerModelId`, `update:useOwnApiKey`, `update:query` | `byok-key` (consumer-owned UI ключа; пакет не читает и не хранит значение) | Buefy (`b-dropdown`, `b-button`, `b-autocomplete`) |
| `ChatHistory` | `messages` (обязателен, `[{id,text,outgoing}]`), `ariaLabel`, `ariaLive` (по умолчанию `"polite"`) | — | `body`, `metadata`, `status` (scoped `{ message }`), `empty` | `@iam3xtr/ui` theme |
| `MessageComposer` | `v-model` (`modelValue`), `disabled`, `busy`, `placeholder`, `ariaLabel`, `textareaAriaLabel`, `submitAriaLabel` | `update:modelValue`, `submit` (trimmed непустая строка) | `submit-icon` | `@iam3xtr/ui` theme |

### ChatHistory и MessageComposer

`ChatHistory` выводит входной массив в заданном порядке с ключами по стабильным
`id`. Без `body` slot поле `text` отображается как экранированный текст;
`outgoing` определяет сторону сообщения. `metadata` и `status` получают
исходное сообщение, поэтому время, доставка и retry остаются за consumer.
Пустое состояние заполняется через `empty` slot; пакет не добавляет текст.

`MessageComposer` принимает управляемый draft через `v-model`. Ввод эмитит
`update:modelValue`, а Enter без Shift и кнопка отправки эмитят `submit` с
непустым trimmed текстом только при `!disabled && !busy` и вне IME composition.
Shift+Enter добавляет новую строку. `submit` не очищает draft: consumer
сбрасывает модель после успешной отправки и сохраняет её при отказе.
Передавайте локализованные `placeholder`, `textareaAriaLabel` и
`submitAriaLabel`; пакет не содержит видимых строк. Textarea начинается
с высоты кнопки, растёт до 100 px и затем прокручивается внутри. В bounded
flex-column history занимает доступное пространство и прокручивается отдельно.
Стили находятся в `@iam3xtr/ui` под новыми `tr-chat-history*` и
`tr-message-composer*` selectors; старые chat selectors сохраняются.

`ToolbarDropdown` и `MobileFilters` используют общий overlay: открытое меню
перекрывает следующий контент и меняет направление у края viewport. Если
предок обрезает overflow, меню переносится в Buefy body portal; внутри
modal/drawer/другого dropdown оно остаётся в том же DOM-контексте и при
необходимости получает `position: fixed`. Положение обновляется при
scroll/resize. Buefy сохраняет управление закрытием, клавиатурой и mobile
modal; компоненты не вводят собственных обработчиков этих действий.

Для других `b-dropdown` core entrypoint экспортирует
`resolveDropdownPlacement(anchor)`, `useDropdownOverlay(options)`, четыре
значения `POSITIONS` и класс-маркер `DROPDOWN_OVERLAY_MARKER`. Вызывайте
resolver после mount корневого `.dropdown`: он возвращает `"inline"`,
`"fixed"` или `"portal"`. Передайте в composable refs на Buefy trigger,
`.dropdown-menu`, его ближайший `.dropdown` wrapper, состояние из
`active-change` и связанный с `position` ref; `appendToBody` задаёт portal,
`fixed` — закрепление внутри обрезающего modal/drawer. При portal Buefy
перемещает menu в `body`, поэтому refs на menu и wrapper надо обновить после
открытия. Импорт entrypoint не требует browser globals.

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

### `ModelSelect`: режимы `model`, `byok`, `both`

`ModelSelect` — публичный выбор модели с тремя фиксированными режимами.
В одном компоненте объединены каталожный режим (`mode === "model"`),
BYOK-каталог + свободный BYOK identifier (`mode === "byok"`) и
переключаемый режим с видимым switch ( `mode === "both"`). Для других
значений `mode` Vue выводит dev-предупреждение validator.

Данные полностью готовит consumer, компонент сам не фильтрует каталог и не
делает запросов:

- `models` (обязателен) — каталог `[{ id, name, provider? }]` с устойчивым
  строковым `id`. Из `provider` читаются только `icon`/`protocol`/`id` для
  иконки (fallback — `brain`).
- `recommendedModels` — массив `id` из `models`; показывается, пока query
  пуст или состоит из пробелов. Неизвестные `id` пропускаются.
- `searchResults` — полные записи модели; показываются только при непустом
  query. `update:query` эмитится только при реальном изменении query.
- `v-model:model-id` — канонический выбор обычной модели (`id` строкой
  или `null`). Активна в режимах `model` и при `useOwnApiKey === false`
  в `both`.
- `v-model:byok-model-id` — канонический BYOK-каталог id. Активна в
  режимах `byok` и при `useOwnApiKey === true` в `both`.
- `v-model:provider-model-id` — свободный BYOK id (например,
  `openai/gpt-4o-mini`). Взаимоисключающее с `byok-model-id`: выбор
  catalog BYOK id очищает free-form id, commit free-form id очищает
  catalog BYOK id. Обычный `model-id` при этом не затрагивается.
- `v-model:use-own-api-key` — есть смысл только в `mode === "both"`,
  полностью контролируется consumer. В одиночных режимах switch не
  отображается, а scope фиксирован (`model` / `byok` соответственно).
  Само переключение никогда не стирает `model-id` / `byok-model-id` /
  `provider-model-id` — это скрытое состояние consumer.
- Trigger показывает имя по активной `v-model` связи. В BYOK-scope
  `providerModelId` всегда выигрывает у `byokModelId` на закрытом
  trigger (это последний commit пользователя); каталожная отметка
  внутри popup относится только к активному id.
- Free-form действие (`freeformActionLabel` / `freeformActionAriaLabel`)
  появляется, только если: scope === BYOK; query непуст после trim;
  consumer не вернул результатов; `loading === false` и `error === false`.
  Trimmed id без пробелов и длиной ≤ 255 символов; некорректный ввод
  блокирует кнопку и подсвечивается `freeformErrorLabel`.
  `freeformActionLabel` поддерживает placeholder `{id}`: первое его
  вхождение заменяется trimmed query (например, `Использовать «{id}»`);
  без placeholder строка выводится как есть.
- Принятие free-form id с клавиатуры — Enter в строке поиска, пока
  free-form действие видимо (IME composition игнорируется). Кнопка
  действия находится в `#empty` slot `b-autocomplete` и недостижима
  Tab/стрелками: Tab закрывает popup, стрелки ходят только по списку
  результатов. Кнопка остаётся pointer-путём; подсказку про Enter при
  необходимости передайте через `freeformHint`.
- Компонент принимает один набор `models` / `recommendedModels` /
  `searchResults` и сам не делит его по scope. В `mode === "both"`
  consumer подменяет все три массива по текущему `useOwnApiKey`
  (например, в BYOK scope — только OpenRouter-модели) и держит в
  `models` записи активного scope, чтобы trigger и отметка выбора
  находили имя по id. Неизвестный `byokModelId` trigger показывает как
  сам id.
- `loading` / `error` — состояние запроса consumer. Когда видимый список
  пуст, popup показывает ровно одно сообщение с приоритетом
  error > loading > empty: `errorLabel` (`role="alert"`), `loadingLabel`
  (`role="status"`, `aria-busy="true"`) или `emptyLabel`
  (`role="status"`). Free-form действие при `loading === true` или
  `error === true` не становится candidate.
- `invalid` — ошибка валидации на закрытом trigger (`is-danger` +
  `aria-invalid="true"`); `inputId` становится `id` trigger-кнопки, чтобы
  внешний `<label for>` или сводка ошибок формы ссылались на неё.
  `disabled` блокирует открытие.
- Слот `byok-key` — consumer-owned UI ключа в BYOK scope. Пакет не
  читает и не хранит его значение, не обращается к API, не реализует
  permission policy. Ключ и его lifecycle остаются за consumer.

Компонент i18n-нейтрален: все видимые тексты и accessible names
(`triggerPlaceholder`, `searchPlaceholder`, `triggerAriaLabel`,
`searchAriaLabel`, `triggerTitle`, `emptyLabel`, `loadingLabel`,
`errorLabel`, `switchLabel`, `switchAriaLabel`, `freeformActionLabel`,
`freeformActionAriaLabel`, `freeformHint`, `freeformErrorLabel`) по
умолчанию пустые и передаются consumer. Popup — один внешний
`b-dropdown` на общем overlay (`useDropdownOverlay`, см. выше): search
row и результаты остаются в одном popup, внутренний `b-autocomplete`
не создаёт второй body-portal и не выбирает своё направление; Buefy
сохраняет keyboard/focus/close и layering в modal/drawer. Popup выровнен по левому краю trigger и при необходимости раскрывается вверх.

#### Адаптация production-формы

`ModelSelect` намеренно не переносит поведение текущего production
selector `get.3xtr.im`. Если форме оно нужно, consumer реализует его явно
вокруг компонента:

- **`returnObject`** — компонент всегда эмитит только `id`; объект модели
  consumer получает сам по `id` из своего каталога.
- **hidden `name`** — скрытого `<input>` нет; для native form submit
  consumer рендерит его сам.
- **auto-select** — компонент не подменяет выбор, если `modelId` пропал
  из `models`; решение (сбросить, выбрать первую модель, показать
  `invalid`) принимает consumer.

```vue
<script setup>
import { computed, ref, watch } from "vue";
import { ModelSelect } from "@iam3xtr/vue";

const props = defineProps({ models: Array, recommended: Array });
const modelId = ref(null);
const query = ref("");

// returnObject: объект по id — на стороне consumer.
const selectedModel = computed(() => props.models.find((m) => m.id === modelId.value) ?? null);

const searchResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? props.models.filter((m) => m.name.toLowerCase().includes(q)) : [];
});

// auto-select: явная политика consumer вместо скрытого поведения компонента.
watch(() => props.models, (next) => {
  if (modelId.value != null && next?.length && !next.some((m) => m.id === modelId.value)) {
    modelId.value = next[0].id;
  }
}, { immediate: true });
</script>

<template>
  <label for="agent-model">{{ t("agent.model") }}</label>
  <ModelSelect
    v-model:model-id="modelId"
    input-id="agent-model"
    :models="models"
    :recommended-models="recommended"
    :search-results="searchResults"
    :trigger-placeholder="t('agent.modelPlaceholder')"
    :search-placeholder="t('agent.modelSearch')"
    :empty-label="t('agent.modelEmpty')"
    @update:query="query = $event"
  />
  <!-- hidden name: только если форма отправляется нативно -->
  <input type="hidden" name="model" :value="modelId ?? ''" />
</template>
```

#### Адаптация BYOK: demo и production

Текущие selectors с BYOK устроены иначе, чем пакет; при переходе
consumer явно переносит их поведение в свой adapter:

| Текущее поведение | Адаптация к `ModelSelect` |
| --- | --- |
| Demo `src/components/agents/ModelSelect.vue` с `:use-own-api-key="true"`, `v-model` + `v-model:provider-model-id` | `mode="byok"`, `v-model:byok-model-id` + `v-model:provider-model-id`. |
| Demo: внешний `b-switch` BYOK рядом с двумя selectors | `mode="both"` и `v-model:use-own-api-key` вместо двух экземпляров либо внешний switch + `mode` `model`/`byok`. |
| Demo: при выключении BYOK очищается `providerModelId` | Пакет draft не стирает; очистка при выключении или перед save — решение consumer. |
| Demo и production: OpenRouter filter в BYOK scope | Consumer фильтрует `models`/`recommendedModels`/`searchResults` сам (см. выше). |
| Production `get.3xtr.im`: одно `modelValue` для обычной и BYOK-модели | Consumer раскладывает сохранённое значение в `modelId` или `byokModelId` по `useOwnApiKey` при загрузке и собирает payload из активной связи при save. |
| Production: switch виден по permission `agents.api_key.use` | Consumer выбирает `mode`: без permission — `model`, с permission — `both`. Пакет permission не проверяет. |
| Production: поле API key (text/password) внутри selector | Поле ключа или выбор сохранённого ключа (как demo `ApiKeySelect`) consumer рендерит в slot `byok-key` или рядом; пакет secret не принимает. |
| Production: recommended fallback на весь каталог, `returnObject`, hidden `name`, auto-select | См. «Адаптация production-формы»: всё — на стороне consumer. |

Перенос `ModelSelect` в `get.3xtr.im` — отдельная задача consumer
(`get.3xtr.im#19`, после `api.3xtr.im#112`); этот пакет её не выполняет.

## Компоненты (`./navigation`)

| Компонент | Пропсы | Требует |
| --- | --- | --- |
| `PageHeader` | `title`, `subtitle`, `back` (`{ to, title? }`) | Vue Router; Buefy (`b-icon`) при переданном `back` |
| `NavbarTabs` | `items` (обязателен, `{ label, to }[]`), `ariaLabel` (по умолчанию `"Навигационные вкладки"`), `prevLabel`/`nextLabel` (доступные имена стрелок, по умолчанию `"Предыдущие вкладки"`/`"Следующие вкладки"`). Занимает свободную ширину контейнера; стрелки появляются только при фактическом переполнении и прокручивают к следующей скрытой вкладке, активная вкладка остаётся видимой после перехода и resize | Vue Router |
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
