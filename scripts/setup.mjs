#!/usr/bin/env node
/**
 * Premier lancement : `npm run setup`.
 *
 * Prépare tout ce qui n'est pas dans le dépôt — le fichier `.env`, la base Postgres (conteneur
 * Docker décrit par `docker-compose.yml`) et le schéma (migrations Drizzle) — pour qu'il ne reste
 * plus qu'à lancer `npm run dev`.
 *
 * Idempotent : relançable sans risque. Un `.env` existant n'est jamais écrasé, `docker compose up`
 * ne fait rien si le conteneur tourne déjà, et Drizzle ne rejoue pas une migration appliquée.
 */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(projectRoot, ".env");
const envExamplePath = join(projectRoot, ".env.example");

const MIN_NODE_MAJOR = 20;
const HOST_PORT = "5433";
const HEALTH_TIMEOUT_MS = 120_000;

/** Clés LLM dont au moins une doit être renseignée pour que la génération de contenu fonctionne. */
const LLM_KEYS = ["GEMINI_API_KEY", "GROQ_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"];

function step(message) {
  console.log(`\n[1m▶ ${message}[0m`);
}

function fail(message, hint) {
  console.error(`\n[31m✖ ${message}[0m`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

/** Exécute une commande en affichant sa sortie ; renvoie le code de retour. */
function run(command, args, { shell = false } = {}) {
  const result = spawnSync(command, args, { cwd: projectRoot, stdio: "inherit", shell });
  if (result.error && result.error.code === "ENOENT") return null;
  return result.status;
}

/** Exécute une commande en capturant sa sortie ; renvoie null si la commande est introuvable. */
function capture(command, args) {
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------- 1. prérequis

step("Vérification des prérequis");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < MIN_NODE_MAJOR) {
  fail(
    `Node ${process.versions.node} est trop ancien (Next 16 exige Node ${MIN_NODE_MAJOR}+).`,
    "Installer une version LTS récente : https://nodejs.org",
  );
}
console.log(`  Node ${process.versions.node} — ok`);

if (capture("docker", ["compose", "version"]) === null) {
  fail(
    "Docker n'est pas disponible (ou le démon n'est pas démarré).",
    "Installer Docker Desktop (https://docs.docker.com/get-docker/) puis le lancer, et relancer `npm run setup`.\n" +
      "  Alternative sans Docker : un Postgres local avec l'extension pgvector, puis renseigner DATABASE_URL dans .env\n" +
      "  et lancer `npm run db:migrate` (voir drizzle/README_PGVECTOR.md).",
  );
}
console.log("  Docker — ok");

// ------------------------------------------------------------------- 2. .env

step("Fichier .env");

if (existsSync(envPath)) {
  console.log("  .env existe déjà — laissé intact.");
} else {
  if (!existsSync(envExamplePath)) fail(".env.example est introuvable.");
  let env = readFileSync(envExamplePath, "utf8");
  // Un AUTH_SECRET vide fait échouer toute connexion (src/lib/auth/session.ts) : on en génère un.
  env = env.replace(/^AUTH_SECRET=\s*$/m, `AUTH_SECRET=${randomBytes(32).toString("hex")}`);
  writeFileSync(envPath, env);
  console.log("  .env créé depuis .env.example, avec un AUTH_SECRET généré.");
}

// Un .env préexistant peut venir d'une copie manuelle sans AUTH_SECRET — on complète.
let envContent = readFileSync(envPath, "utf8");
if (/^AUTH_SECRET=\s*$/m.test(envContent)) {
  envContent = envContent.replace(/^AUTH_SECRET=\s*$/m, `AUTH_SECRET=${randomBytes(32).toString("hex")}`);
  writeFileSync(envPath, envContent);
  console.log("  AUTH_SECRET était vide — une valeur a été générée.");
}

// ---------------------------------------------------------------- 3. Postgres

step("Base Postgres (Docker)");

// Une base peut déjà occuper le port sans venir de ce docker-compose (conteneur lancé à la main,
// Postgres natif...). Dans ce cas `docker compose up` échouerait sur le bind du port : mieux vaut
// le dire clairement que laisser lire une erreur Docker.
const composeContainerBefore = capture("docker", ["compose", "ps", "-q", "postgres"]);
const occupying = capture("docker", ["ps", "-q", "--filter", `publish=${HOST_PORT}`]);
if (occupying && !composeContainerBefore) {
  const name = capture("docker", ["inspect", "--format", "{{.Name}}", occupying.split("\n")[0]]);
  fail(
    `Le port ${HOST_PORT} est déjà occupé par le conteneur ${name ?? occupying}.`,
    "S'il s'agit d'une base CreaFlow lancée à la main, il n'y a rien à faire ici : garder ce conteneur et\n" +
      "  lancer simplement `npm run db:migrate`. Sinon, libérer le port (`docker rm -f <conteneur>`) et relancer.",
  );
}

if (run("docker", ["compose", "up", "-d"]) !== 0) {
  fail("`docker compose up -d` a échoué.", "Vérifier que Docker Desktop est bien démarré.");
}

const container = capture("docker", ["compose", "ps", "-q", "postgres"])?.split("\n")[0];
if (!container) fail("Le conteneur Postgres est introuvable après `docker compose up -d`.");

process.stdout.write("  Attente de la disponibilité de la base");
const deadline = Date.now() + HEALTH_TIMEOUT_MS;
let healthy = false;
while (Date.now() < deadline) {
  if (capture("docker", ["inspect", "--format", "{{.State.Health.Status}}", container]) === "healthy") {
    healthy = true;
    break;
  }
  process.stdout.write(".");
  await sleep(2000);
}
console.log("");
if (!healthy) {
  fail(
    "La base n'est pas devenue disponible dans le temps imparti.",
    `Inspecter les logs du conteneur : docker compose logs postgres`,
  );
}
console.log(`  Base prête sur localhost:${HOST_PORT}.`);

// -------------------------------------------------------------- 4. migrations

step("Application des migrations");

// npm est un .cmd sous Windows : il faut passer par le shell pour que spawn le trouve.
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
if (run(npm, ["run", "db:migrate"], { shell: process.platform === "win32" }) !== 0) {
  fail(
    "`npm run db:migrate` a échoué.",
    "Si l'erreur mentionne l'extension `vector`, la base utilisée n'est pas celle du docker-compose\n" +
      "  (image pgvector) — vérifier DATABASE_URL dans .env.",
  );
}

// ------------------------------------------------------------- 5. clés LLM

const hasLlmKey = LLM_KEYS.some((key) => new RegExp(`^${key}=.+$`, "m").test(readFileSync(envPath, "utf8")));

console.log("\n[32m✔ Installation terminée.[0m");
if (!hasLlmKey) {
  console.log(
    "\n[33m⚠ Aucune clé LLM n'est renseignée dans .env.[0m\n" +
      "  L'app démarrera, mais l'onboarding ne pourra rien générer. Renseigner au choix :\n" +
      "    GEMINI_API_KEY  (défaut, quota gratuit — https://aistudio.google.com/apikey)\n" +
      "    GROQ_API_KEY    (quota gratuit plus généreux — penser à mettre LLM_PROVIDER=groq)\n" +
      "    ANTHROPIC_API_KEY ou OPENAI_API_KEY (payantes)",
  );
}
console.log("\nLancer l'app : npm run dev  →  http://localhost:3000");
