# @iam3xtr/vue

Reusable Vue layer for 3xtr.im applications.

Owns portable Vue components and framework-level composables for UI state, focus management, and overlays. It may depend on the visual contract from `@iam3xtr/ui`.

It must not contain API clients, Pinia stores, RBAC, product routes, fixture data, wizard locales, tariff or domain policy, or product-specific URLs. Those remain in each consuming application.

The package is prepared for private GitHub Packages publication. Its current
root entry is deliberately empty: Task A11.3 adds documented component and
composable exports. Vue/Buefy/Router peer ranges, and the compatible
`@iam3xtr/ui` peer dependency, are introduced only with those real exports.
