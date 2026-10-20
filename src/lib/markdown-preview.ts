export function markdownPreview(content: string): string {
  return content.replace(/^\*\*Discord - [\s\S]*?\*\*\s*/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "").replace(/[`*_~#>]/g, "").replace(/\s+/g, " ").trim();
}
