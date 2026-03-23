/**
 * Input Sanitization & Prompt Injection Guard
 *
 * Prevents:
 *   - XSS via HTML/script injection
 *   - Prompt injection attacks (jailbreaks, role overrides)
 *   - Excessively long inputs
 *
 * This runs on every API request BEFORE the input reaches the LLM.
 */

const MAX_INPUT_LENGTH = 500;

// Known prompt injection patterns — case-insensitive
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions?|prompt|rules?)/i,
  /forget\s+(everything|instructions?|rules?)/i,
  /you\s+are\s+now\s+(a|an|the)/i,
  /act\s+as\s+(a|an|the)\s+(?!tour\s+guide)/i, // Allow "act as a tour guide"
  /new\s+(persona|identity|role|character)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /do\s+anything\s+now/i,
  /system\s*:\s*you/i,
  /\[INST\]/i,       // Llama instruction format injection
  /<\|im_start\|>/i, // ChatML injection
];

export interface SanitizeResult {
  valid: boolean;
  sanitized: string;
  error?: string;
}

/**
 * Strips HTML tags and sanitizes user input for safe LLM consumption.
 */
export function sanitizeInput(raw: string): SanitizeResult {
  if (!raw || typeof raw !== "string") {
    return { valid: false, sanitized: "", error: "Input must be a string" };
  }

  // Trim whitespace
  let input = raw.trim();

  // Enforce max length
  if (input.length > MAX_INPUT_LENGTH) {
    return {
      valid: false,
      sanitized: "",
      error: `Input too long. Maximum ${MAX_INPUT_LENGTH} characters allowed.`,
    };
  }

  // Reject empty input
  if (input.length === 0) {
    return { valid: false, sanitized: "", error: "Input cannot be empty" };
  }

  // Strip HTML tags (prevent XSS in stored messages)
  input = input.replace(/<[^>]*>/g, "");

  // Check for prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      console.warn("[Security] Blocked prompt injection attempt:", input.slice(0, 100));
      return {
        valid: false,
        sanitized: "",
        error: "Invalid input detected.",
      };
    }
  }

  // Normalize whitespace
  input = input.replace(/\s+/g, " ").trim();

  return { valid: true, sanitized: input };
}
