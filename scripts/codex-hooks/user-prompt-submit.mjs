import {
  buildAdditionalContext,
  extractPrompt,
  portalLogPath,
  promptLooksKnowledgeWorthy,
  promptLooksLikeRuntimeFailure,
  readStdinJson,
  writeAdditionalContext,
} from "./shared.mjs";

const event = await readStdinJson();
const prompt = extractPrompt(event);
const runtimeFailure = promptLooksLikeRuntimeFailure(prompt);
const knowledgeWorthy = promptLooksKnowledgeWorthy(prompt);

const extraSections = [];
if (runtimeFailure) {
  extraSections.push(
    [
      "Runtime failure hook:",
      `- The user appears to report that something does not work. Before diagnosing BF6 Portal behavior, inspect \`${portalLogPath}\` and summarize the relevant log lines.`,
    ].join("\n"),
  );
}

if (knowledgeWorthy) {
  extraSections.push(
    [
      "Knowledge hook:",
      "- If this turn produces a reusable lesson, append only a concise, edited note to `codex-knowledge/bf6-portal-knowledge.md`.",
      "- Do not copy raw conversation text, raw prompts, or full command/log output into the knowledge file.",
    ].join("\n"),
  );
}

writeAdditionalContext("UserPromptSubmit", buildAdditionalContext(extraSections));
