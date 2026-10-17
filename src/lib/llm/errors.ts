/**
 * Translates an LLM provider error into a sentence for the screen. The raw error stays in the logs:
 * the person needs to know whether it's worth retrying, not the HTTP code.
 */
export function llmFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/credit|quota|billing|insufficient/i.test(raw)) {
    return "The AI service refused the request: the OpenAI account is out of credits.";
  }
  if (/\b401\b|api key|unauthori[sz]ed|incorrect.*key/i.test(raw)) {
    return "The AI service is not configured: the OpenAI key is missing or invalid.";
  }
  if (/\b429\b|rate limit/i.test(raw)) {
    return "The AI service is overloaded at the moment.";
  }
  return "The AI service did not respond.";
}
