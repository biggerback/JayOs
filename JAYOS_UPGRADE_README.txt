JayOS upgrade — YouTube, TikTok, and JaySearch

WHAT'S INCLUDED
- Your existing Guest desktop, Games, Notes and themes are preserved.
- YouTube app: paste public YouTube video URLs (including Shorts) to watch supported embeds.
- TikTok app: paste full public TikTok video URLs to watch supported embeds.
- Browser search: tries public Bing RSS web results, falls back to Wikipedia when blocked. Google full-web search link opens in a new tab.
- Browser results pointing to YouTube/TikTok open the video player.
- Fixed Cloudflare wrangler.jsonc so the ASSETS binding is configured.

LIMITATIONS
- Video platforms can restrict embedding. TikTok short vm.tiktok.com links need to be expanded to full /video/ URLs.
- YouTube/TikTok full interactive feeds, account login and in-app video search are not provided.
- Bing RSS is a public endpoint and may throttle or block Workers; Wikipedia fallback is narrower than general web search.
- No paid search or video API keys required.

CLOUDFLARE DEPLOY
1. Back up the current working GitHub repository before changing it.
2. Copy the contents of this ZIP's JayOS folder into the ROOT of your GitHub repo, preserving public/index.html.
3. Confirm root contains worker.js and wrangler.jsonc and public/index.html.
4. Deploy command: npx wrangler deploy --config ./wrangler.jsonc
5. Do NOT paste the config into a Cloudflare environment variable.
6. Test / then /api/search?q=minecraft.
7. If deployment fails, roll back to your saved working Cloudflare deployment.

The ZIP contains source files, not a deployed or live-tested service.
