# Hunter System — Solo Leveling Quest Tracker

A gamified habit tracker inspired by Solo Leveling's Hunter system with full authentication.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Framer Motion
- **Backend**: Express + PostgreSQL + JWT Authentication
- **State Management**: Zustand
- **Routing**: React Router v7

## Quick Start

### 1. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd server && npm install && cd ..
```

### 2. Start Database (Docker)

```bash
# Copy environment file
cp .env.example .env

# Start PostgreSQL and Adminer
docker-compose up -d

# Wait for database to be ready
sleep 10
docker-compose ps
```

### 3. Run the Application

```bash
# Option A: Run everything together
npm run dev:all

# Option B: Run separately
npm run dev          # Frontend on http://localhost:5173
npm run dev:server   # Backend on http://localhost:3000
```

### 4. Login

Open http://localhost:5173/login and use:
- **Username**: `demo_user`
- **Password**: `DemoPass123!`

## Project Structure

```
hunter-system/
├── docker-compose.yml      # PostgreSQL + Adminer
├── server/                 # Express API
│   ├── src/
│   │   ├── index.ts       # Entry point
│   │   ├── db.ts          # Database connection + seeding
│   │   ├── middleware/
│   │   │   └── auth.ts    # JWT authentication middleware
│   │   └── routes/
│   │       ├── auth.ts    # Auth routes (login, register, me)
│   │       ├── quests.ts  # Quest CRUD
│   │       ├── stats.ts   # Stats endpoints
│   │       └── rank.ts    # Rank progression
│   └── package.json
├── src/
│   ├── components/
│   │   ├── auth/          # Auth components (ProtectedRoute, AuthProvider)
│   │   ├── layout/        # Sidebar, TopBar
│   │   └── ...
│   ├── pages/
│   │   ├── Login.tsx      # Login/Register page
│   │   ├── Dashboard.tsx
│   │   ├── QuestLog.tsx
│   │   └── ...
│   ├── store/
│   │   ├── authStore.ts   # Auth state management
│   │   └── gameStore.ts   # Game state
│   └── lib/
│       └── api.ts         # API client with auth support
└── package.json
```

## Authentication API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (sets HttpOnly cookie) |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| GET | `/api/auth/me` | Get current user (requires auth) |

### Request/Response Examples

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": process.env.DEMO_USER, "password": process.env.DEMO_PASS}' \
  -c cookies.txt
```

**Get Current User:**
```bash
curl http://localhost:3000/api/auth/me \
  -H "Cookie: token=<your-jwt>"
```

## Database Schema

```sql
users:
  - id (SERIAL PRIMARY KEY)
  - username (VARCHAR UNIQUE)
  - password_hash (TEXT) - bcrypt hashed
  - name (VARCHAR)
  - rank (VARCHAR) - E, D, C, B, A, S
  - xp (INTEGER)
  - hp, mp (INTEGER)
  - stats (str, agi, vit, int, sen)
  - created_at, updated_at (TIMESTAMP)

quests:
  - id (SERIAL PRIMARY KEY)
  - quest_id (VARCHAR UNIQUE)
  - title, xp_reward, category, difficulty
  - is_daily (BOOLEAN)

quest_completions:
  - quest_id (FK)
  - completion_date (DATE)
  - UNIQUE(quest_id, completion_date)

rank_history:
  - user_id (FK)
  - rank, xp_at_rank
  - achieved_at (TIMESTAMP)
```

## Environment Variables

Create a `.env` file:

```env
# Database
POSTGRES_USER=hunter
POSTGRES_PASSWORD=hunterpass
POSTGRES_DB=hunter_system
DATABASE_PORT=5432
DB_HOST=localhost
DB_USER=hunter
DB_PASSWORD=hunterpass
DB_NAME=hunter_system

# JWT
JWT_SECRET=your-secret-key-here-change-in-production

# Server
BACKEND_PORT=3000
FRONTEND_PORT=5173
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# Adminer
ADMINER_PORT=8080

# Frontend API URL
VITE_API_URL=http://localhost:3000/api
```

## Development Commands

```bash
# Start frontend dev server
npm run dev

# Start backend with auto-reload
npm run dev:server

# Start both together
npm run dev:all

# Build for production
npm run build

# Preview production build
npm run preview

# Docker commands
npm run docker:up    # Start database
npm run docker:down  # Stop database
```

## Features

### Authentication
- JWT-based auth with HttpOnly cookies
- Secure password hashing with bcrypt
- Protected routes (redirect to login if not authenticated)
- Auto-login check on page load

### Quest System
- 90+ quests including 75 LeetCode problems
- Daily quests with completion tracking
- XP rewards for each quest
- Category-based organization
- Progress persistence to database

### Character Progression
- Rank system: E → D → C → B → A → S
- XP-based leveling
- Stats: STR, AGI, VIT, INT, SEN
- HP/MP management

### Data Persistence
- All quest completions saved to PostgreSQL
- User profiles persisted across sessions
- Fallback to localStorage when backend unavailable
- Automatic sync when backend is available

## Testing the Login Flow

1. Start the app: `npm run dev:all`
2. Open http://localhost:5173
3. You'll be redirected to /login
4. Enter credentials: `demo_user` / `DemoPass123!`
5. Click "ENTER SYSTEM"
6. You'll be redirected to the Dashboard
7. Complete quests and see your XP increase
8. Check your rank progression

## Security Notes

- Passwords are hashed with bcrypt (10 rounds)
- JWTs are stored in HttpOnly cookies (prevents XSS)
- CORS is configured to only allow your frontend
- In production, use HTTPS and a strong JWT_SECRET

## Troubleshooting

**Backend won't start:**
- Make sure Docker is running: `docker-compose ps`
- Check if PostgreSQL is ready: `docker-compose logs postgres`

**Login fails:**
- Check if backend is running: `curl http://localhost:3000/api/health`
- Verify database is seeded: Check that demo user was seeded from DEMO_USER

**Frontend shows "Backend unavailable":**
- Start backend: `npm run dev:server`
- Data will still work with localStorage fallback
