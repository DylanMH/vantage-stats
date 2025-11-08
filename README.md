# 🎯 Kovaak's Insight

A powerful desktop application for tracking, analyzing, and visualizing your Kovaak's FPS Aim Trainer performance.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Built with](https://img.shields.io/badge/built%20with-Electron-47848F)

## ✨ Features

### 📊 **Performance Tracking**
- Automatic import of Kovaak's CSV statistics
- Real-time file watching for instant updates
- Historical trend analysis with interactive charts
- Track accuracy, score, TTK (Time to Kill), and more

### 🎯 **Goal System**
- Auto-generated personalized goals based on your performance
- Manual goal creation for specific scenarios
- Visual progress tracking with completion percentages
- Smart goal recommendations

### 📦 **Pack Management**
- Create custom scenario packs
- Import Kovaak's playlist JSON files as packs
- Filter stats by pack or individual scenarios
- Quick-access pack statistics

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
- Kovaak's FPS Aim Trainer installed

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/kovaaks-insight.git
   cd kovaaks-insight
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

**Pre-built releases coming soon!**

For now, you can build the app yourself using the instructions above.

## 🖥️ Usage

### First Launch
1. Select your Kovaak's stats folder: 
   - Usually located at: `%LOCALAPPDATA%/FPSAimTrainer/Saved/SaveGames/Stats`
   - Or: `C:\Users\YourName\AppData\Local\FPSAimTrainer\Saved\SaveGames\Stats`

2. (Optional) Select your playlists folder for importing playlists as packs:
   - Usually located at: `%LOCALAPPDATA%/FPSAimTrainer/Saved/SaveGames/Playlists`

3. The app will automatically scan and import all your CSV files

### Importing Playlists
1. Go to **Settings** page
2. Click **"📥 Import Playlist"** button
3. Select a Kovaak's playlist JSON file
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
kovaaks-insight/
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

- Built for the Kovaak's FPS Aim Trainer community
- Inspired by the need for better aim training analytics
- Thanks to all contributors and users!

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/kovaaks-insight/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/kovaaks-insight/discussions)

## 🗺️ Roadmap

- [ ] Multiple UI themes
- [ ] Advanced filtering options
- [ ] Export data to CSV/JSON
- [ ] Comparison mode (compare multiple sessions)
- [ ] Cloud backup/sync (optional)
- [ ] macOS and Linux support

---

**Made with ❤️ for the aim training community**
