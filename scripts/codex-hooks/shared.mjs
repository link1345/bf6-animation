import fs from "node:fs";
import path from "node:path";

export const repoRoot = process.cwd();
export const knowledgeDir = path.join(repoRoot, "codex-knowledge");
export const knowledgeBasePath = path.join(knowledgeDir, "bf6-portal-knowledge.md");

export const portalLogPath =
  "%LOCALAPPDATA%\\Temp\\Battlefield\u00e2\u201e\u00a2 6\\PortalLog.txt";

const runtimeFailureTerms = [
  "\u52d5\u304b\u306a\u3044",
  "\u52d5\u304d\u307e\u305b\u3093",
  "\u52d5\u4f5c\u3057\u306a\u3044",
  "\u8d77\u52d5\u3057\u306a\u3044",
  "\u843d\u3061\u308b",
  "\u30af\u30e9\u30c3\u30b7\u30e5",
  "\u30a8\u30e9\u30fc",
  "\u5931\u6557",
  "\u52d5\u304b\u3093",
  "not work",
  "doesn't work",
  "does not work",
  "broken",
  "fail",
  "failed",
  "failure",
  "crash",
  "error",
];

const knowledgeWorthyTerms = [
  "\u30a8\u30e9\u30fc",
  "\u5931\u6557",
  "\u30ed\u30b0",
  "\u5b9f\u884c\u30ed\u30b0",
  "\u30ce\u30a6\u30cf\u30a6",
  "\u30b3\u30c4",
  "\u539f\u56e0",
  "\u89e3\u6c7a",
  "\u56de\u907f",
  "\u6ce8\u610f",
  "\u30ad\u30e3\u30c3\u30b7\u30e5",
  "\u30eb\u30fc\u30d7",
  "\u8ca0\u8377",
  "\u6700\u9069\u5316",
  "error",
  "fail",
  "failed",
  "log",
  "tip",
  "cache",
  "loop",
  "performance",
];

const runtimeFailurePattern = new RegExp(runtimeFailureTerms.join("|"), "i");
const knowledgeWorthyPattern = new RegExp(knowledgeWorthyTerms.join("|"), "i");

export async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export function readKnowledgeBase() {
  try {
    return fs.readFileSync(knowledgeBasePath, "utf8").trim();
  } catch {
    return "";
  }
}

export function extractPrompt(event) {
  return String(event.prompt ?? event.userPrompt ?? event.message ?? event.raw ?? "");
}

export function promptLooksLikeRuntimeFailure(prompt) {
  return runtimeFailurePattern.test(prompt);
}

export function promptLooksKnowledgeWorthy(prompt) {
  return knowledgeWorthyPattern.test(prompt);
}

export function buildAdditionalContext(extraSections = []) {
  const sections = [
    "BF6 Portal repo hook guidance:",
    "- If `bf6-portal-typescript-mcp` is available, use it first when BF6 Portal SDK, docs, API, or behavior is unclear.",
    `- If the user says the Portal server or script does not work, inspect the runtime log before guessing: \`${portalLogPath}\`.`,
    "- Do not store raw conversation logs, raw user prompts, or full execution logs as knowledge.",
    "- When a reusable lesson is learned, write a short human-curated note to `codex-knowledge/bf6-portal-knowledge.md`: symptom, cause, fix, and when to reuse it.",
  ];

  const knowledge = readKnowledgeBase();
  if (knowledge) {
    sections.push("", "Current local BF6 Portal knowledge:", knowledge);
  }

  for (const section of extraSections.filter(Boolean)) {
    sections.push("", section);
  }

  return sections.join("\n");
}

export function writeAdditionalContext(hookEventName, additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName,
        additionalContext,
      },
    }),
  );
}
