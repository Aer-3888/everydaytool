# EveryDayTool

Personal tools for everyday use. The live site is at [everydaytool.theo-phan-quoc-huy.workers.dev](https://everydaytool.theo-phan-quoc-huy.workers.dev).

## Includes

- A public coin flip.
- A private budget planner protected by Google sign-in.
- Multiple income sources, recurring expenses, BNPL payment counts, and end dates for monthly expenses.
- A three-month balance projection that moves French weekend and public-holiday payments to the next business day.
- Automatic saving for budget changes.

## Use

The coin flip works without an account. The budget is restricted to the configured Google account. Add income and expenses, then use the projected balance to see the expected result over the next three months.

For BNPL, enter the amount for each payment and the number of payments remaining. For a monthly expense, set an optional end date.

## Run locally

Node.js 22.13 or newer is required.

```bash
npm ci
cp .env.example .env
npx wrangler d1 migrations apply everydaytool --local
npm run dev
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` to test Google sign-in locally.

## Deployment

The app runs on Cloudflare Workers with D1. The GitHub Actions deployment workflow runs after a merge to `main`. It requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.
