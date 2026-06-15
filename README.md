# KVB Vendor Risk360 — TPRM Platform

Full-stack TPRM (Third-Party Risk Management) web application built for Karur Vysya Bank.

**Stack:** React + Tailwind CSS (frontend) · Node.js/Express (backend) · PostgreSQL (database)  
**Hosting:** Render · **AI Layer:** Anthropic Claude API

---

## Project Structure

```
vendor-risk360/
├── backend/          # Express API
│   ├── server.js
│   └── src/
│       ├── db/       # Schema + migrations
│       ├── middleware/
│       └── routes/   # auth, vendors, risk, findings, documents, ai
├── frontend/         # React app
│   └── src/
│       ├── pages/    # Dashboard, Vendors, Findings, Documents, etc.
│       ├── components/
│       ├── contexts/
│       └── utils/
├── render.yaml       # Render deployment config
└── README.md
```

---

## Local Development

### Backend
```bash
cd backend
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npm install
node server.js
```

### Frontend
```bash
cd frontend
# Create .env.local:
echo "REACT_APP_API_URL=http://localhost:5000" > .env.local
npm install
npm start
```

Default admin login: `admin@kvbank.com` / `Admin@123`

---

## Deploy to Render

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_ORG/vendor-risk360.git
git push -u origin main
```

### Step 2 — Create Render Services

**Option A — Blueprint (recommended)**  
In Render dashboard: New → Blueprint → connect repo → Render reads `render.yaml` automatically.

**Option B — Manual**

1. **PostgreSQL Database**
   - New → PostgreSQL
   - Name: `vendor-risk360-db`
   - Plan: Starter ($7/mo)
   - Region: Singapore

2. **Backend Web Service**
   - New → Web Service → connect repo
   - Root directory: `backend`
   - Build: `npm install`
   - Start: `node server.js`
   - Plan: Standard ($25/mo)
   - Add env vars (see below)

3. **Frontend Static Site**
   - New → Static Site → connect repo
   - Root directory: `frontend`
   - Build: `npm install && npm run build`
   - Publish: `build`
   - Add rewrite rule: `/* → /index.html`
   - Add env: `REACT_APP_API_URL=https://vendor-risk360-api.onrender.com`

### Step 3 — Environment Variables (Backend)

| Variable | Value |
|---|---|
| `DATABASE_URL` | From Render PostgreSQL → Internal Connection String |
| `JWT_SECRET` | Any long random string (32+ chars) |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `FRONTEND_URL` | Your Render static site URL |
| `NODE_ENV` | `production` |

### Step 4 — Verify

1. Backend health: `https://vendor-risk360-api.onrender.com/health`  
   Should return `{"status":"ok"}`

2. Open frontend URL → Login with `admin@kvbank.com` / `Admin@123`

3. Change the admin password immediately after first login.

---

## Modules

| Module | Status |
|---|---|
| Vendor Registry & Lifecycle | ✅ Complete |
| Auto-Classification Engine | ✅ Complete |
| Risk Questionnaire (5 domains) | ✅ Complete |
| Risk Scoring Engine | ✅ Complete |
| Findings Management | ✅ Complete |
| Document Management | ✅ Complete |
| AI Insights (Claude) | ✅ Complete |
| Vendor Portal (login) | ✅ Complete |
| Dashboard & Charts | ✅ Complete |
| Audit Trail | ✅ Complete |
| Supply Chain / Fourth-Party | 🔜 Phase 2 |
| Renewal Alerts | 🔜 Phase 2 |
| Email Notifications | 🔜 Phase 2 |
| PDF Reports | 🔜 Phase 2 |

---

## Security Notes

- All passwords hashed with bcrypt (10 rounds)
- JWT tokens expire in 8 hours
- Audit trail is append-only (no UPDATE/DELETE)
- Change default admin password on first login
- For production: enable SSL, set `NODE_ENV=production`
