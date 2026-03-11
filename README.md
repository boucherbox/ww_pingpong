# Ping Pong Tournament App

A full-stack tournament management web app built with Next.js, SQLite, and Tailwind CSS.

## Features

- **4 tournament formats**: Single Elimination, Double Elimination, Round Robin, Swiss System
- **Admin dashboard** (password-protected) to create tournaments, manage brackets, and mark winners
- **Public view** with live bracket, match schedule, and leaderboard
- **Auto-refreshing** public view (every 10 seconds)
- **SQLite persistence** — data survives server restarts

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and edit it:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=yourpassword
DATABASE_PATH=./data/tournament.db
SESSION_SECRET=your-long-random-secret
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the public page.

Admin dashboard: [http://localhost:3000/admin](http://localhost:3000/admin)

### 4. (Optional) Seed sample data

```bash
npx tsx scripts/seed.ts
```

This creates a sample 8-player single-elimination tournament for testing.

## Project Structure

```
app/
  page.tsx              — Public home page
  admin/
    login/page.tsx      — Admin login
    page.tsx            — Admin dashboard
    AdminDashboard.tsx  — Client dashboard component
  api/
    auth/login/         — POST login
    auth/logout/        — POST logout
    tournament/         — GET/POST tournaments
    tournament/[id]/
      players/          — POST add players
      generate/         — POST generate bracket
      complete/         — POST mark complete
    matches/[id]/winner — POST set match winner
    public/tournament/  — GET public tournament data

lib/
  db.ts                 — SQLite connection, schema, queries
  bracket.ts            — Bracket generation & advancement logic
  auth.ts               — JWT session helpers

components/
  PublicView.tsx        — Tabbed public interface
  BracketTree.tsx       — Visual bracket component
  Leaderboard.tsx       — Standings table
  AdminBracketView.tsx  — Admin bracket management

scripts/
  seed.ts               — Creates sample tournament data

middleware.ts           — Admin route protection
```

## Tournament Formats

| Format | Description |
|--------|-------------|
| Single Elimination | One loss = eliminated. Byes for non-power-of-2 counts |
| Double Elimination | Two losses to eliminate. Winners + Losers brackets |
| Round Robin | Every player vs every other player once |
| Swiss | Paired by record each round, configurable number of rounds |
