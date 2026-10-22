/** Splits comma-separated input into tags: trims, drops empty pieces. */
export function parseTags(text: string): string[] {
  return text
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}
