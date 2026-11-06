import type { ForumContentBlock } from "~/types/forum";

// Input is the validated, normalized body that will be stored with this title.
export const generateForumThreadTitle = (blocks: ForumContentBlock[], locale: "zh" | "ja") => {
  const paragraph = blocks.find(block => block.type === "paragraph" && block.text.trim());
  if (!paragraph || paragraph.type !== "paragraph") return locale === "ja" ? "画像共有" : "图片分享";
  const text = paragraph.text.trim().split(/\r?\n/, 1)[0].replace(/\s+/g, " ");
  const sentence = text.match(/^.*?[。！？!?](?:[」』”’])?|^.*?\.(?=\s|$)/u)?.[0] || text;
  if (sentence.length <= 120) return sentence;
  // Stay within the existing UTF-16 limit without splitting a Unicode grapheme.
  let title = "";
  for (const { segment } of new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(sentence)) {
    if (title.length + segment.length > 119) break;
    title += segment;
  }
  return title ? `${title}…` : (locale === "ja" ? "画像共有" : "图片分享");
};
