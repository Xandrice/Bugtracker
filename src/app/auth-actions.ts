"use server";

import { signIn } from "@/../auth";

/** Starts Discord OAuth immediately (no intermediate sign-in page). */
export async function signInWithDiscord(callbackUrl = "/") {
    await signIn("discord", { redirectTo: callbackUrl });
}
