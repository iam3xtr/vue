# @iam3xtr/vue

Reusable Vue layer for 3xtr.im applications.

Owns portable Vue components and framework-level composables for UI state, focus management, and overlays. It may depend on the visual contract from `@iam3xtr/ui`.

It must not contain API clients, Pinia stores, RBAC, product routes, fixture data, wizard locales, tariff or domain policy, or product-specific URLs. Those remain in each consuming application.

The package will be published privately through GitHub Packages. Until the migration stage is implemented, this repository is intentionally a boundary definition rather than a released package.