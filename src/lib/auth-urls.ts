const DISCORD_SIGN_IN_PATH = "/api/auth/signin/discord";

/** Direct Discord OAuth URL — skips the NextAuth provider selection page. */
export function discordSignInUrl(callbackUrl = "/") {
    const params = new URLSearchParams();
    if (callbackUrl && callbackUrl !== "/") {
        params.set("callbackUrl", callbackUrl);
    }
    const query = params.toString();
    return query ? `${DISCORD_SIGN_IN_PATH}?${query}` : DISCORD_SIGN_IN_PATH;
}
