"use client";

import { useState, useRef, useEffect } from "react";
import { updateProjectMemberRole, removeProjectMember } from "@/app/actions";
import { MoreHorizontal, ShieldAlert, User, Trash2 } from "lucide-react";

interface ManageMemberActionsProps {
    memberId: string;
    currentRole: string;
}

export function ManageMemberActions({ memberId, currentRole }: ManageMemberActionsProps) {
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
                onClick={() => setIsOpen(!isOpen)}
                disabled={isUpdating}
                className={`p-1.5 rounded-md transition-colors disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isOpen
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
            >
                {isUpdating ? <span className="text-xs">...</span> : <MoreHorizontal className="h-4 w-4" />}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-md bg-background border shadow-lg z-10 py-1" role="menu">
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Change Role
                    </div>
                    {currentRole !== "Admin" && (
                        <button
                            onClick={() => handleRoleChange("Admin")}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                            role="menuitem"
                        >
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                            Make Admin
                        </button>
                    )}
                    {currentRole !== "Member" && (
                        <button
                            onClick={() => handleRoleChange("Member")}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                            role="menuitem"
                        >
                            <User className="h-4 w-4" />
                            Make Member
                        </button>
                    )}

                    <div className="h-px bg-border my-1"></div>
                    <button
                        onClick={handleRemove}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        role="menuitem"
                    >
                        <Trash2 className="h-4 w-4" />
                        Remove Member
                    </button>
                </div>
            )}
        </div>
    );
}
