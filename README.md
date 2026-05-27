[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/PzCCy7VV)

# Banking API

A secure RESTful banking API built with NestJS, Prisma, and PostgreSQL. Supports user authentication, account management, and financial transactions (deposit, withdrawal, transfer).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 11 (TypeScript) |
| ORM | Prisma 5 |
| Database | PostgreSQL (Supabase) |
| Auth | JWT + bcrypt |
| Validation | class-validator |
| Documentation | Swagger / OpenAPI |
| Testing | Jest |
| Deployment | Render |

## Project Structure

```
src/
├── auth/               # Register, login, JWT strategy & guard
├── user/               # Profile read & update
├── account/            # Account CRUD
├── transaction/        # Deposit, withdraw, transfer
├── prisma/             # PrismaService (global)
└── common/
    └── filters/        # Global HTTP exception filter
prisma/
├── schema.prisma       # Database models: User, Account, Transaction
└── migrations/         # SQL migration history
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret key for signing JWTs | any long random string |
| `JWT_EXPIRES_IN` | Token expiry duration | `7d` |
| `PORT` | Port the server listens on | `3001` |

## Local Development

### Prerequisites

- Node.js 18+
- npm
- A PostgreSQL database (Supabase free tier recommended)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill env file
cp .env.example .env
# → set DATABASE_URL to your Supabase connection string
# → set JWT_SECRET to a long random string

# 3. Apply database migrations
npx prisma migrate deploy

# 4. Start development server
npm run start:dev
```

The API will be available at `http://localhost:3001`.
Swagger docs will be at `http://localhost:3001/api/docs`.

## Database Migrations

```bash
# Apply all pending migrations (production / CI)
npx prisma migrate deploy

# Create a new migration during development
npx prisma migrate dev --name your_migration_name

# Open Prisma Studio (browser-based DB viewer)
npm run prisma:studio
```

## Running Tests

```bash
# Unit tests (40 tests across 3 suites)
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:cov
```

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register a new user |
| POST | `/auth/login` | Public | Login and receive JWT |

### User

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/user/profile` | JWT | Get own profile |
| PATCH | `/user/profile` | JWT | Update own profile |

### Accounts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/accounts` | JWT | Create a bank account |
| GET | `/accounts` | JWT | List own accounts |
| GET | `/accounts/:id` | JWT | Get account by ID |
| PATCH | `/accounts/:id` | JWT | Update account |
| DELETE | `/accounts/:id` | JWT | Delete account |

### Transactions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/transactions/deposit` | JWT | Deposit into account |
| POST | `/transactions/withdraw` | JWT | Withdraw from account |
| POST | `/transactions/transfer` | JWT | Transfer between accounts |
| GET | `/transactions` | JWT | List own transactions |
| GET | `/transactions/:id` | JWT | Get transaction by ID |

## API Documentation (Swagger)

Start the server and open:

```
http://localhost:3001/api/docs
```

To test protected endpoints in Swagger:
1. Call `POST /auth/login` to get a token
2. Click the **Authorize** button (top right padlock icon)
3. Paste your token value (without the word `Bearer`) and click **Authorize**
4. All protected endpoints will now include the token automatically

## Deployment (Render)

This project includes a `render.yaml` for one-click deployment.

### Steps

1. Push this repository to GitHub
2. Go to [https://render.com](https://render.com) and create a free account
3. Click **New → Web Service** and connect your GitHub repository
4. Render detects `render.yaml` automatically
5. In the **Environment** section, add these secret variables:
   - `DATABASE_URL` — your Supabase connection string
   - `JWT_SECRET` — generate with: `openssl rand -hex 32`
6. Click **Deploy**

On each deploy, Render will:
- Run `npm ci && npm run build` to compile TypeScript
- Run `prisma migrate deploy` on startup to apply any pending migrations
- Start the server with `node dist/main`

### Production Build (manual)

```bash
npm run build
npm run start:prod
```

## Security

- Passwords are hashed with bcrypt (10 salt rounds)
- JWTs expire after 7 days by default
- All private endpoints are protected by `JwtAuthGuard`
- Users can only access their own accounts and transactions
- Account ownership is enforced server-side on every request
- No secrets are hardcoded — all sensitive values come from environment variables
- `.env` is excluded from version control via `.gitignore`
