/**
 * Metadata Optimizer — ensures YouTube metadata stays within platform limits.
 *
 * Limits:
 *   - Title: max 100 characters
 *   - Description: max 5000 characters
 *   - Tags: deduplicated (case-insensitive), max 500 chars combined
 */

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TAGS_COMBINED_LENGTH = 500;

interface MetadataInput {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
}

interface OptimizedMetadata {
  readonly title: string;
  readonly description: string;
  readonly tags: string[];
}

export function optimizeMetadata(input: MetadataInput): OptimizedMetadata {
  const title = input.title.length > MAX_TITLE_LENGTH
    ? input.title.slice(0, MAX_TITLE_LENGTH)
    : input.title;

  const description = input.description.length > MAX_DESCRIPTION_LENGTH
    ? input.description.slice(0, MAX_DESCRIPTION_LENGTH)
    : input.description;

  // Deduplicate tags case-insensitively, keeping first occurrence
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const tag of input.tags) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(tag);
    }
  }

  // Trim combined tag length to YouTube's limit
  const tags: string[] = [];
  let combinedLength = 0;
  for (const tag of deduped) {
    if (combinedLength + tag.length > MAX_TAGS_COMBINED_LENGTH) break;
    tags.push(tag);
    combinedLength += tag.length;
  }

  return { title, description, tags };
}
