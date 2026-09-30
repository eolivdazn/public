// Environment label for non-production builds: the stage workflow sets SITE_ENV=stage and
// SITE_REF=<branch>, exposed to the client by envPrefix in vite.config.mjs. Mirrors
// siteEnvLabel() in scripts/build-site.mjs. Unset SITE_ENV (prod, local) means no label.
const rawEnv = String(import.meta.env?.SITE_ENV || "")
  .trim()
  .replace(/[^a-z0-9-]/gi, "");

export const SITE_ENV_LABEL =
  rawEnv && rawEnv.toLowerCase() !== "production" ? rawEnv.charAt(0).toUpperCase() + rawEnv.slice(1).toLowerCase() : "";

export const SITE_REF = String(import.meta.env?.SITE_REF || "").trim();
