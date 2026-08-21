# Deploying SilverHands to Vercel (100% Free Tier)

SilverHands is fully architected to run on **100% free-tier** services and open-source infrastructure with zero mandatory costs.

---

### 1. Cost Breakdown ($0.00 / completely free)

| Component | Service | Tier & Cost |
| :--- | :--- | :--- |
| **Hosting & Web App** | Vercel | **Hobby Tier ($0 / month)** - 100GB bandwidth, unlimited static assets |
| **Serverless Backend** | Vercel Serverless Functions (`/api`) | **Free Tier ($0)** - 100k executions/day |
| **Interactive Map & Tiles** | CARTO Voyager, OpenStreetMap, OpenTopo | **100% Open & Free** - No API key or credit card needed |
| **Audio Voice Synthesizer** | Web Speech API (Native Browser Engine) | **100% Free** - Runs directly on device |
| **Database & Realtime Sync** | Firebase Firestore (Spark Plan) / LocalStorage | **Free Tier ($0 / month)** - 50k reads, 20k writes/day |
| **AI Processing** | Google AI Studio Gemini API | **Free Tier** - 15 RPM free rate limit |

---

### 2. How to Deploy to Vercel for Free (Step-by-Step)

#### Option A: Deploy via GitHub (Recommended)
1. In Google AI Studio, click **Settings / Export** → **Export to GitHub** (or download the ZIP and push to GitHub).
2. Go to **[vercel.com](https://vercel.com)** and log in with your free account.
3. Click **"Add New Project"** and import your GitHub repository.
4. Framework Preset: **Vite**
5. Build Settings (Default):
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
6. Add Environment Variable:
   - `GEMINI_API_KEY`: *(Paste your free Gemini API key from Google AI Studio / aistudio.google.com)*
7. Click **Deploy**. Vercel will build and give you a free `https://your-app.vercel.app` URL with SSL.

#### Option B: Deploy via Vercel CLI (Command Line)
```bash
npm install -g vercel
vercel
# Follow the interactive prompts and select default settings.
```

---

### 3. Pre-configured Files for Vercel
- `vercel.json`: Handles client-side routing & serverless API rewrites.
- `/api/index.ts`: Dedicated serverless function proxying Gemini AI and multilingual translations.
