"use strict";

// GPT-4.1 corrupts non-ASCII characters in structured JSON output on long inputs: instead of
// emitting "Ü" for Ü it emits "\u0000dc", so JSON.parse yields a real NUL character followed
// by the two hex digits. The damage is invisible until the text reaches an API that rejects NUL -
// Klaviyo's template endpoints answer "null characters not allowed" and the whole language fails.
//
// The repair has to happen on the raw JSON text, before parsing. Stripping the NUL after the fact
// would leave the hex digits behind as literal copy ("Überraschung" -> "dcberraschung"), which is
// worse than the error: it ships silently.
//
// Reference: https://github.com/openai/openai-go/issues/664

const ESCAPED_NULL_PATTERN = /(\\+)u0000([0-9a-fA-F]{2})?/g;
const LITERAL_NULL_WITH_HEX = /\u0000([0-9a-fA-F]{2})/g;
const LITERAL_NULL = /\u0000/g;

// Removes NUL characters from a string. Used as the last guard before an outbound API call, where
// the right answer is to lose one character rather than the whole request.
function stripNullCharacters(value) {
  if (typeof value !== "string") return value;
  return value.replace(LITERAL_NULL, "");
}

function stripNullCharactersDeep(value) {
  if (typeof value === "string") {
    return stripNullCharacters(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripNullCharactersDeep(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      acc[stripNullCharacters(key)] = stripNullCharactersDeep(entry);
      return acc;
    }, {});
  }

  return value;
}

// Repairs the raw JSON text a model returned, so the characters the model meant to emit survive.
function repairModelJsonText(text) {
  const source = typeof text === "string" ? text : String(text || "");
  if (!source) return source;

  const escapesRepaired = source.replace(ESCAPED_NULL_PATTERN, (match, slashes, hexTail) => {
    // An even run of backslashes means the backslash itself is escaped, so "u0000" is literal text
    // inside the string rather than a unicode escape. Leave it alone.
    if (slashes.length % 2 === 0) return match;
    const prefix = slashes.slice(0, -1);
    return hexTail ? `${prefix}\\u00${hexTail}` : prefix;
  });

  // A raw NUL byte in the stream is invalid JSON whatever follows it, so repairing the same
  // corruption in its unescaped form can only improve the outcome.
  const literalsRepaired = escapesRepaired.replace(LITERAL_NULL_WITH_HEX, (match, hex) => (
    String.fromCharCode(parseInt(hex, 16))
  ));

  return stripNullCharacters(literalsRepaired);
}

function parseModelJson(text) {
  return JSON.parse(repairModelJsonText(text));
}

module.exports = {
  parseModelJson,
  repairModelJsonText,
  stripNullCharacters,
  stripNullCharactersDeep
};
