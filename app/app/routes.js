import { index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/_index/route.jsx"),

  // Shopify Admin Layout
  layout("routes/app.jsx", [
    route("app", "routes/app._index.jsx"),
    route("app/additional", "routes/app.additional.jsx"),
    route("app/vault", "routes/app.vault.jsx"),
  ]),

  // API Routes
  route("api/verify", "routes/api.verify.jsx"), // <-- ADD THIS LINE

  // Auth & Webhooks
  route("auth/*", "routes/auth.$.jsx"),
  route("auth/login", "routes/auth.login/route.jsx"),
  route("webhooks/app/scopes_update", "routes/webhooks.app.scopes_update.jsx"),
  route("webhooks/app/uninstalled", "routes/webhooks.app.uninstalled.jsx"),
];