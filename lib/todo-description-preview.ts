export type TodoDescriptionPart =
  | { type: "image"; alt: string; url: string }
  | { type: "link"; label: string; url: string }
  | { type: "text"; text: string };

const markdownAttachmentRe = /(!?)\[([^\]]*)\]\(([^)\s]+[^)]*)\)/g;

export function parseTodoDescriptionParts(description: string): TodoDescriptionPart[] {
  const parts: TodoDescriptionPart[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  markdownAttachmentRe.lastIndex = 0;
  while ((match = markdownAttachmentRe.exec(description)) !== null) {
    const index = match.index;
    if (index > cursor) {
      parts.push({ type: "text", text: description.slice(cursor, index) });
    }

    const [, imageMarker, label, url] = match;
    if (imageMarker === "!") {
      parts.push({ type: "image", alt: label || "Image jointe", url });
    } else {
      parts.push({ type: "link", label: label || url, url });
    }
    cursor = index + match[0].length;
  }

  if (cursor < description.length) {
    parts.push({ type: "text", text: description.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: description }];
}
