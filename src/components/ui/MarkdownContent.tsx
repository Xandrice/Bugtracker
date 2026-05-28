import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/components/ui/cn";

export function MarkdownContent({
    content,
    className,
}: {
    content: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "prose prose-sm dark:prose-invert max-w-none text-sm",
                "prose-p:my-1 prose-pre:my-2 prose-code:before:content-[''] prose-code:after:content-['']",
                className
            )}
        >
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
