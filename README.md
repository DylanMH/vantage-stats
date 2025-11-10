# 🎯 Vantage Stats

A powerful desktop application for tracking, analyzing, and visualizing your FPS Aim Trainer performance.

> **Disclaimer:** Vantage Stats is an independent, community-created tool and is not affiliated with, endorsed by, or associated with Kovaak's FPS Aim Trainer, Aim Lab, or any other FPS training software. All trademarks belong to their respective owners.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Built with](https://img.shields.io/badge/built%20with-Electron-47848F)

👉 [Download the latest](https://github.com/DylanMH/vantage-stats/releases)

## ✨ Features

### 📊 **Performance Tracking**
- Automatic import of FPS trainer CSV statistics
- Real-time file watching for instant updates
- Historical trend analysis with interactive charts
- Track accuracy, score, TTK (Time to Kill), and more

### 🎯 **Goal System**
- Auto-generated personalized goals based on your performance
- Visual progress tracking with completion percentages
- Smart goal recommendations

### 📦 **Pack Management**
- Create custom scenario packs
- Import playlist JSON files as packs
- Filter stats by pack or individual scenarios
- Quick-access pack statistics

### 🎮 **Session Tracking & Comparison**
- Manual session tracking with start/stop controls
- Name and annotate your training sessions
- Compare performance between any two time windows:
  - Sessions vs sessions
  - Today vs yesterday
  - Custom time ranges
  - Relative time blocks (last 24h, last week, etc.)
- Overall and per-task performance breakdowns
- Visual diff indicators showing improvement or decline

### 📈 **Advanced Analytics**
- Moving average smoothing for trend visualization
- Best performance settings tracking (DPI, sensitivity, FOV)
- Day-by-day run breakdowns
- Comprehensive task summaries

### ⚙️ **Smart Features**
- First-launch setup wizard
- Manual CSV folder rescanning
- Settings persistence across sessions
- Optional playlists folder for easy imports

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- FPS Aim Trainer installed (Kovaak's, Aim Lab, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vantage-stats.git
   cd vantage-stats
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   # Terminal 1 - Start frontend dev server
   npm run dev
   
   # Terminal 2 - Start Electron app
   npm start
   ```

4. **Build for production**
   ```bash
   npm run build:start
   ```

5. **Package the application**
   ```bash
   npm run dist
   ```

## 📥 Download

### Windows Installer

1. **Download the latest release**
   - Go to [Releases](https://github.com/DylanMH/vantage-stats/releases)
   - Download `Vantage-Stats-Setup.exe`

2. **Run the installer**
   - Double-click the downloaded `.exe` file

3. **⚠️ Windows SmartScreen Warning**
   
   Windows Defender SmartScreen may block the installer because the app isn't digitally signed (code signing certificates are expensive!).
   
   **To proceed safely:**
   - Click **"More info"** on the SmartScreen popup
   - Click **"Run anyway"** button
   
   ![Windows SmartScreen Bypass](https://i.imgur.com/28le4sB.png)
   
   *The app is safe - it's open source and you can review all the code in this repository. SmartScreen blocks unsigned apps by default to protect users.*

4. **First launch setup**
   - The app will guide you through selecting your FPS trainer stats folder
   - Optionally select your playlists folder for easy imports
   - Choose whether to enable auto-generated goals

### Build From Source

If you prefer to build the app yourself, follow the [Installation](#installation) instructions above.

## 🖥️ Usage

### First Launch
1. Select your FPS trainer stats folder: 
   - **Kovaak's**: `%LOCALAPPDATA%/FPSAimTrainer/Saved/SaveGames/Stats`
   - Or: `C:\Users\YourName\AppData\Local\FPSAimTrainer\Saved\SaveGames\Stats`

2. (Optional) Select your playlists folder for importing playlists as packs:
   - Usually located at: `%LOCALAPPDATA%/FPSAimTrainer/Saved/SaveGames/Playlists`

3. The app will automatically scan and import all your CSV files

### Importing Playlists
1. Go to **Settings** page
2. Click **"📥 Import Playlist"** button
3. Select a playlist JSON file from your trainer
4. The playlist will be imported as a new pack with all scenarios

### Creating Goals
- **Automatic**: Goals are generated based on your performance
- **Manual**: Go to Goals page → "Create Custom Goal"

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS
- **Backend**: Node.js, Express, SQLite
- **Desktop**: Electron
- **Build**: Vite, electron-builder
- **Charts**: Custom SVG-based charting

## 📂 Project Structure

```
vantage-stats/
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Main page components
│   │   └── hooks/        # Custom React hooks
├── backend/           # Node.js backend server
│   ├── server.js         # Express API server
│   ├── csvParser.js      # CSV file parser
│   ├── watcher.js        # File system watcher
│   ├── goals.js          # Goal generation logic
│   └── db.js             # Database utilities
├── electron/          # Electron main process
│   ├── main.js           # Electron entry point
│   └── index.html        # Setup screen HTML
└── package.json       # Root package configuration
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Style
- Follow existing code conventions
- Use TypeScript for type safety
- Write descriptive commit messages
- Add comments for complex logic

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the FPS aim training community
- Inspired by the need for better aim training analytics
- Thanks to all contributors and users!
- Not affiliated with any FPS training software

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/DylanMH/vantage-stats/issues)

## 🗺️ Roadmap

- [x] Session tracking and comparison mode
- [ ] Advanced filtering options
- [ ] Export data to CSV/JSON
- [ ] Cloud backup/sync (optional)
- [ ] Task specific goals

---

**Made with ❤️ for the aim training community**
