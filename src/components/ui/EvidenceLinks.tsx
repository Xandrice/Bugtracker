export function EvidenceLinks({ content }: { content: string }) {
  return <span className="whitespace-pre-wrap break-words">{content.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => /^https?:\/\//.test(part) ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline">{part}</a> : part)}</span>;
}
