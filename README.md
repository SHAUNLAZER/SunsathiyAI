# SunSathiyAI

SunSathiyAI is an interactive voice-enabled application that proxies Speech-to-Text (STT) and Text-to-Speech (TTS) requests to the Gnani (Vachana) platform securely.

---

## 🚀 Quick Start (Local Run)

### Prerequisites
- **Node.js 20+** installed on your system.
- No `npm install` needed (zero external dependencies).

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your Gnani API key:
```env
GNANI_API_KEY=your_actual_api_key_here
```

### 2. Run Server
```bash
node server.mjs
# or
npm start
```

### 3. Open in Browser
Navigate to [http://localhost:3000](http://localhost:3000).

---

## 📁 Repository Structure

```
.
├── index.html          # Main application page (accessible via root /)
├── sunsathiyai.html    # Original application HTML
├── server.mjs          # Node.js HTTP server & Gnani API proxy (/api/stt, /api/tts)
├── package.json        # Project metadata & start scripts
├── .env.example        # Environment variable template
├── .gitignore          # Prevents committing secrets (.env)
└── README.md           # Documentation
```

---

## 🌐 Deploying to GitHub & Cloud Platforms

### Pushing to GitHub
1. Initialize git and commit:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of SunSathiyAI"
   ```
2. Create a new repository on [GitHub](https://github.com/new).
3. Push to your GitHub repository:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```

### Deploying the App
Because the voice capabilities require the secure backend proxy in `server.mjs` to keep your `GNANI_API_KEY` private, deploy this project using a Node.js-compatible host connected to your GitHub repo:

- **Render / Railway / Fly.io / Heroku**:
  - Connect your GitHub repository.
  - Set Build Command: *(leave empty or `npm install`)*
  - Set Start Command: `node server.mjs` (or `npm start`)
  - Add your Environment Variable:
    - Key: `GNANI_API_KEY`
    - Value: `<your-gnani-api-key>`
