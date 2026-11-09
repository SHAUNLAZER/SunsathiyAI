# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Voice (Gnani / Vachana) setup

1. Copy `.env.example` to `.env` and set `GNANI_API_KEY` (a `.dev.vars` copy is used when running on the Cloudflare/Wrangler runtime).
2. Restart the dev server after changing it.
3. For deployment, add `GNANI_API_KEY` as an environment variable/secret in your host (Vercel: Project → Settings → Environment Variables; Cloudflare: Worker secrets), then redeploy.

The key is read only in server routes (`src/lib/gnani.ts`), so it is never sent to the browser.
