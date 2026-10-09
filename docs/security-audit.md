# Dependency audit — 9 October 2026

Installed/pinned patched direct packages: Prisma/client6.19.3, React Router7.18.4, http-proxy-middleware3.0.7, express-rate-limit8.7.1, Vite7.3.7. Versions were checked against the package registry; tests/build were rerun.

`npm audit --omit=dev` still reports6 high advisory entries: @prisma/config, deepmerge-ts, prisma, braces, micromatch, http-proxy-middleware. These are dependency-tree entries, not6 separately confirmed exploits in this application. Prisma CLI is retained for migrations and imports deepmerge-ts; changing its major transitively without validating compatibility is not done. The gateway supplies fixed function path filters, not client-supplied glob patterns, so the micromatch/braces path is not fed user patterns. No patched braces release was available in the registry at this check.

This is an unresolved dependency-audit limitation and requires review before production release. It does not change the passed functional tests. No external deployment occurred. Audit is not a proof that all security properties have been verified; repeat it at deployment time.
