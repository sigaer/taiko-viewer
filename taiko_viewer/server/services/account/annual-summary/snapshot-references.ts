import { createReadStream } from "node:fs";

const HASH_REFERENCE_PATTERN = /"(?:sha256|contentHash)"\s*:\s*"([0-9a-f]{64})"/gi;
const REFERENCE_OVERLAP_CHARS = 192;

const collectFromText = (text: string, output: Set<string>) => {
  HASH_REFERENCE_PATTERN.lastIndex = 0;
  for (let match = HASH_REFERENCE_PATTERN.exec(text); match; match = HASH_REFERENCE_PATTERN.exec(text)) {
    output.add(match[1].toLowerCase());
  }
};

/**
 * Finds normalized snapshot references without materializing and parsing the
 * complete annual summary. The overlap covers references split across stream
 * chunks; duplicate matches are intentionally collapsed by the Set.
 *
 * A textual false positive only preserves an otherwise unused cache entry, so
 * the cleanup remains conservative in the presence of unexpected JSON data.
 */
export const collectSnapshotHashesFromJsonFile = async (
  filePath: string,
  output = new Set<string>()
) => {
  let overlap = "";
  const stream = createReadStream(filePath, { encoding: "utf8" });
  for await (const chunk of stream) {
    const text = overlap + chunk;
    collectFromText(text, output);
    overlap = text.slice(-REFERENCE_OVERLAP_CHARS);
  }
  return output;
};
