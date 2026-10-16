# syntax=docker/dockerfile:1
#
# Image de production de CreaFlow — docs/DEPLOIEMENT_VPS.md.
#
# Trois étapes : `deps` installe node_modules à partir du lockfile, `builder` fait `next build` en
# mode `output: "standalone"` (next.config.ts), `runner` ne garde que le strict nécessaire pour
# `node server.js`. L'étape `builder` sert aussi de conteneur jetable pour les migrations
# (service `migrate` de docker-compose.prod.yml) : elle a drizzle-kit, drizzle.config.ts et le
# dossier drizzle/, que l'image finale n'embarque pas.
#
# Debian slim plutôt qu'Alpine : sharp (vignettes de la bibliothèque visuelle) et pg fournissent
# des binaires précompilés pour glibc, aucune compilation sur le VPS.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
# Variables inlinées dans le bundle navigateur ou lues par next.config.ts au moment du build.
# Toutes les autres sont lues à l'exécution (env_file dans docker-compose.prod.yml) et n'ont
# rien à faire ici. Valeurs fournies par `build.args` du compose, elles-mêmes lues dans .env.
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG R2_PUBLIC_BASE_URL=
# APP_URL et SEO_INDEXABLE : lues au build par les pages prérendues (robots, sitemap, image Open
# Graph, canonical des pages légales) — src/lib/seo.ts, docs/SPEC_SEO.md §3.
ARG APP_URL=
ARG SEO_INDEXABLE=
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=$NEXT_PUBLIC_GOOGLE_PICKER_API_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    R2_PUBLIC_BASE_URL=$R2_PUBLIC_BASE_URL \
    APP_URL=$APP_URL \
    SEO_INDEXABLE=$SEO_INDEXABLE \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --home /app nextjs
# server.js + les node_modules tracés par Next ; public/ et .next/static ne sont pas copiés
# automatiquement par le mode standalone (doc Next.js "output"), d'où les deux lignes suivantes.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
