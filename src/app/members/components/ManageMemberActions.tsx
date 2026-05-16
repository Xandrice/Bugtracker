"use client";

import { useState, useRef, useEffect } from "react";
import { updateProjectMemberRole, removeProjectMember } from "@/app/actions";
import { MoreHorizontal, ShieldAlert, User, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/components/ui/cn";

interface ManageMemberActionsProps {
    memberId: string;
    currentRole: string;
}

export function ManageMemberActions({
    memberId,
    currentRole,
}: ManageMemberActionsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function handleRoleChange(newRole: string) {
        setIsUpdating(true);
        try {
            await updateProjectMemberRole(memberId, newRole);
        } finally {
            setIsUpdating(false);
            setIsOpen(false);
        }
    }

    async function handleRemove() {
        if (!confirm("Are you sure you want to remove this member?")) return;
        setIsUpdating(true);
        try {
            await removeProjectMember(memberId);
        } finally {
            setIsUpdating(false);
            setIsOpen(false);
        }
    }

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isUpdating}
                className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:opacity-50",
                    isOpen
                        ? "bg-muted text-foreground"
                        : "hover:bg-muted hover:text-foreground"
                )}
            >
                {isUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <MoreHorizontal className="h-3.5 w-3.5" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-elevated p-1 shadow-pop z-10">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground">
                        Change role
                    </div>
                    {currentRole !== "Admin" && (
                        <button
                            type="button"
                            onClick={() => handleRoleChange("Admin")}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                        >
                            <ShieldAlert className="h-3.5 w-3.5 text-danger" />
                            Make admin
                        </button>
                    )}
                    {currentRole !== "Member" && (
                        <button
                            type="button"
                            onClick={() => handleRoleChange("Member")}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                        >
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            Make member
                        </button>
                    )}
                    <div className="my-1 h-px bg-border" />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-danger transition-colors hover:bg-danger/10"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove member
                    </button>
                </div>
            )}
        </div>
    );
}
