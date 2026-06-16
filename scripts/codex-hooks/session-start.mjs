import {
  buildAdditionalContext,
  readStdinJson,
  writeAdditionalContext,
} from "./shared.mjs";

await readStdinJson();

writeAdditionalContext("SessionStart", buildAdditionalContext());
