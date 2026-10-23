// Canonical visual channel kinds -> symbol names (MDI via `Icon`'s Buefy
// fallback, or the `@iam3xtr/ui` registry for `channel-max`). Presentation
// only: not a backend provider list. `web` and `widget` are origins of one
// public Web publication; `email`, `whatsapp` and `max` are visual kinds
// only and imply no connector. No `mail` alias is accepted: the API does
// not return one.
//
// `max` uses a neutral chat symbol: use of the official MAX logo is not
// authorized here, so no brand mark is bundled.
export const CHANNEL_TYPE_SYMBOLS = Object.freeze({
  web: "web",
  widget: "code-tags",
  telegram: "send",
  email: "email-outline",
  whatsapp: "whatsapp",
  max: "channel-max",
  unknown: "message-outline",
});

export const CHANNEL_TYPES = Object.freeze(["web", "widget", "telegram", "email", "whatsapp", "max"]);

export function normalizeChannelType(type) {
  return typeof type === "string" ? type.trim().toLowerCase() : "";
}
