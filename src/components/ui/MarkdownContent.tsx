"use client";

import { useEffect, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";
import { cn } from "@/components/ui/cn";

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(?:[?#]|$)/i;

function isImageUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        if (IMAGE_EXT_RE.test(parsed.pathname)) return true;
        // Discord CDN attachments often include the filename in the path
        if (
            (parsed.hostname === "cdn.discordapp.com" ||
                parsed.hostname === "media.discordapp.net") &&
            parsed.pathname.includes("/attachments/")
        ) {
            return IMAGE_EXT_RE.test(parsed.pathname);
        }
        return false;
    } catch {
        return IMAGE_EXT_RE.test(url);
    }
}

function ImageEmbed({
    src,
    alt,
    onOpen,
}: {
    src: string;
    alt?: string;
    onOpen: (src: string, alt?: string) => void;
}) {
    const [failed, setFailed] = useState(false);
    const label = alt?.trim() || "Attachment";

    if (failed) {
        return (
            <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary underline-offset-2 hover:underline"
            >
                {src}
            </a>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onOpen(src, label)}
            className="group my-2 block max-w-md overflow-hidden rounded-md border border-border bg-muted/40 text-left transition-colors hover:border-border-strong focus-ring"
            title="Click to enlarge"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={label}
                loading="lazy"
                onError={() => setFailed(true)}
                className="max-h-64 w-full object-contain bg-elevated"
            />
            <span className="block truncate px-2 py-1 text-[10px] text-muted-foreground group-hover:text-foreground">
                {label === "Attachment" ? "Click to enlarge" : label}
            </span>
        </button>
    );
}

function ImageLightbox({
    src,
    alt,
    onClose,
}: {
    src: string;
    alt?: string;
    onClose: () => void;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={alt || "Image preview"}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/50 text-white transition-colors hover:bg-black/70"
                aria-label="Close"
            >
                <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt || "Attachment"}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-lg"
            />
        </div>
    );
}

export function MarkdownContent({
    content,
    className,
}: {
    content: string;
    className?: string;
}) {
    const [lightbox, setLightbox] = useState<{ src: string; alt?: string } | null>(null);

    const openLightbox = (src: string, alt?: string) => {
        setLightbox({ src, alt });
    };

    return (
        <>
            <div
                className={cn(
                    "prose prose-sm dark:prose-invert max-w-none text-sm",
                    "prose-p:my-1 prose-pre:my-2 prose-code:before:content-[''] prose-code:after:content-['']",
                    "prose-a:break-all",
                    className
                )}
            >
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                        a: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
                            if (href && isImageUrl(href)) {
                                const childText =
                                    typeof children === "string"
                                        ? children
                                        : Array.isArray(children) &&
                                            children.every((c) => typeof c === "string")
                                          ? children.join("")
                                          : undefined;
                                // Autolinked image URLs often render the URL as the link text —
                                // show an embed instead of the long wrapping string.
                                const looksLikeBareUrl =
                                    !childText ||
                                    childText === href ||
                                    childText.replace(/\s+/g, "") === href;
                                if (looksLikeBareUrl) {
                                    return (
                                        <ImageEmbed
                                            src={href}
                                            alt="Attachment"
                                            onOpen={openLightbox}
                                        />
                                    );
                                }
                            }

                            return (
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="break-all"
                                    {...props}
                                >
                                    {children}
                                </a>
                            );
                        },
                        img: ({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) => {
                            if (typeof src !== "string" || !src) return null;
                            return (
                                <ImageEmbed
                                    src={src}
                                    alt={typeof alt === "string" ? alt : "Attachment"}
                                    onOpen={openLightbox}
                                />
                            );
                        },
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
            {lightbox && (
                <ImageLightbox
                    src={lightbox.src}
                    alt={lightbox.alt}
                    onClose={() => setLightbox(null)}
                />
            )}
        </>
    );
}
