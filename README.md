# JayOS — Vercel / Netlify edition

This is a deployable website, not a single offline HTML file. It preserves the JayOS Guest login, Games library, Notes, Settings, and desktop while adding a DuckDuckGo-powered in-window Browser.

## Vercel
1. Extract this ZIP into a folder and push the files to a GitHub repository.
2. Import the repository into Vercel as an **Other** framework project.
3. Leave the root directory as the repository root. Deploy. Vercel installs the dependencies from `package.json` and runs `/api/search` and `/api/page` as serverless functions.

## Netlify
1. Push the extracted folder to GitHub.
2. Import it into Netlify. Build command: **leave empty**; publish directory: **.**.
3. The `netlify.toml` routes `/api/search` and `/api/page` to Netlify Functions.

## Browser capabilities and limits
- Search DuckDuckGo inside JayOS; open search results inside JayOS, with Back/Forward/Home.
- Pages are shown in **safe reading mode**: the server fetches public HTTPS HTML, strips scripts, forms, and embedded content, and shows text and some images. This is **not** a full interactive web proxy.
- Some sites may refuse automated requests, return bot checks, or rely on JavaScript and will not display. DuckDuckGo may rate-limit requests.
- Never enter credentials into proxied pages. The proxy blocks private-network addresses and restricts fetching to HTTPS.
- The Games app still embeds games from OnlineGames.io directly and needs an internet connection.
- Opening `index.html` directly from disk will show the UI, but Browser searches will not work until deployed.

## Development
Run `npm install` and `npx netlify dev` or `npx vercel dev` to test serverless routes locally.
