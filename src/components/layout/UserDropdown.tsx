"use client";

import { Dropdown, DropdownTrigger, DropdownPopover, DropdownMenu, DropdownItem, Avatar } from "@heroui/react";
import { Settings, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserDropdownProps {
    user: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
}

export function UserDropdown({ user }: UserDropdownProps) {
    const router = useRouter();

    return (
        <Dropdown>
            <DropdownTrigger>
                <Avatar
                    className="transition-transform h-8 w-8 text-xs font-semibold cursor-pointer border border-primary/20"
                    size="sm"
                >
                    {user.image && <Avatar.Image src={user.image} className="object-cover h-full w-full" />}
                    <Avatar.Fallback>{user.name?.charAt(0).toUpperCase() || "U"}</Avatar.Fallback>
                </Avatar>
            </DropdownTrigger>
            <DropdownPopover className="border border-default-100 bg-background/90 backdrop-blur-md shadow-lg" placement="bottom end">
                <DropdownMenu aria-label="Profile Actions">
                    <DropdownItem key="profile" className="h-14 gap-2 cursor-default select-none hover:bg-transparent focus:bg-transparent" textValue={`Signed in as ${user.name}`}>
                        <p className="font-semibold text-xs text-default-500">Signed in as</p>
                        <p className="font-semibold text-sm text-foreground truncate">{user.name || user.email || "User"}</p>
                    </DropdownItem>
                    <DropdownItem
                        key="settings"
                        onClick={() => router.push("/settings")}
                    >
                        <span className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-default-500" />
                            Settings
                        </span>
                    </DropdownItem>
                    <DropdownItem
                        key="logout"
                        variant="danger"
                        onClick={() => router.push("/api/auth/signout?callbackUrl=/")}
                    >
                        <span className="flex items-center gap-2">
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </span>
                    </DropdownItem>
                </DropdownMenu>
            </DropdownPopover>
        </Dropdown>
    );
}
