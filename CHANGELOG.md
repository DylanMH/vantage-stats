# Changelog

All notable changes to Vantage Stats will be documented in this file.

## [1.2.0] - 2025-12-14

### 🎯 Major Features

#### **Task-Specific Goals (Auto-Generated)**

- Auto-generates a small set of goals targeted at your most-played tasks
- Goals are created for a specific task and metric (Accuracy / Score / TTK)
- Avoids duplicates and limits the number of auto-generated task goals to prevent spam

### 🛠️ Bug Fixes

#### **Play Time & Session Accuracy**

- Play time now reflects task duration (derived from CSV Challenge Start + filename timestamp)
- Added a one-time automatic migration on launch to recalculate run durations for existing data
- Sessions now compute play time from runs dynamically and clamp play time so it can never exceed session wall-clock duration
- Fixed Sessions list “Today / Yesterday” labeling to use calendar day comparison

#### **Goals & Notifications**

- Fixed repeated “Goal Achieved” notification on every app launch by persisting achievement check state and improving backend time filtering

#### **Stability & Developer Experience**

- Reduced noisy CSV parser debug logs (opt-in via DEBUG_CSV_PARSER)
- Fixed circular dependency warning in backend real-time update pipeline (watcher/server)

## [1.1.0] - 2025-11-09

### 🎮 Major Features

#### **Session Tracking System**

- **Manual Session Control**: Start and stop training sessions with a single click
- **Session Naming**: Optionally name your sessions before starting (e.g., "Morning Practice", "Flick Training")
- **Session Management**: View detailed session information including:
  - Total runs completed
  - Total playtime
  - Session duration
  - All runs performed during the session
- **Session Editing**: Edit session names and add notes after completion
- **Real-time Timer**: Live elapsed time display for active sessions
- **Auto-refresh UI**: Session list automatically updates when sessions end (no manual page reload needed)

#### **Performance Comparison Engine**

- **Flexible Comparison Wizard**: Compare performance between any two time windows
  - **Session vs Session**: Compare two training sessions
  - **Preset Time Ranges**: Today, Yesterday, This Week, Last Week, This Month, Last Month
  - **Relative Time Blocks**: Last 24h, Last 48h, Last 7 days, Last 30 days
  - **Custom Time Ranges**: Select any specific date/time range
- **Comprehensive Analysis**:
  - Overall performance metrics (Score, Accuracy, TTK)
  - Per-task breakdowns showing individual scenario comparisons
  - Statistical percentiles (P50, P95) for deeper insights
- **Visual Diff Indicators**:
  - Green highlighting for improvements
  - Red highlighting for declines
  - Percentage change calculations
  - Clear left/right window labels
- **Smart UI**: Simplified 3-step wizard (Type → Time Windows → Review)

### 🎨 UI/UX Improvements

#### **Navigation**

- Reordered main navigation: Profile → Stats → **Sessions** → Goals → Settings
- Sessions now prominently placed after Stats for easy access

#### **Comparison Interface**

- Removed redundant "Task Scope" step from comparison wizard
- Cleaner, more focused comparison flow
- Task-specific breakdowns always shown by default
- Improved visual hierarchy with vertical layout
- Better diff placement for easier reading
- Hover tooltips for percentile explanations

#### **Session Detail Modal**

- Fixed bug preventing typing in session name edit field
- Fixed bug preventing typing in session notes field
- Pre-filled input fields when editing
- Streamlined delete confirmation
- Better visual organization of session information

### ⚡ Performance & Backend

#### **Code Optimization**

- Comprehensive backend code review and optimization
- Added extensive documentation and comments across all backend files
- Organized API endpoints into clear sections with headers
- Improved code maintainability and readability
- Eliminated redundancy in codebase
- Added helper functions for common patterns (time filtering, window labeling)

#### **Database**

- Efficient session tracking with timestamp-based run filtering
- Proper indexes for fast session queries
- Clean schema design with denormalized stats for performance

#### **API Improvements**

- Added PATCH method support for session updates
- Consistent error handling patterns across all endpoints
- Improved CORS configuration
- RESTful endpoint design
- Enhanced debug logging for comparisons

### 🐛 Bug Fixes

- **Session Editing**: Fixed inability to type when editing session names
- **Session Notes**: Fixed inability to type when editing session notes
- **UI Refresh**: Fixed manual page reload requirement after ending sessions
- **CORS**: Fixed PATCH request blocking for session updates
- **Timestamp Handling**: Improved ISO timestamp comparisons in queries
- **Diff Calculation**: Corrected comparison diffs (right - left for positive improvements)
- **TTK Display**: Fixed Time-to-Kill formatting to show 3 decimal precision

### 🔧 Technical Details

#### **New API Endpoints**

- `POST /api/sessions/start` - Start a new session with optional name
- `POST /api/sessions/:id/end` - End an active session and calculate stats
- `GET /api/sessions` - Get all sessions (with optional active filter)
- `GET /api/sessions/:id` - Get session details with all runs
- `PATCH /api/sessions/:id` - Update session name and/or notes
- `DELETE /api/sessions/:id` - Delete a session
- `POST /api/comparisons/run` - Run a performance comparison
- `POST /api/comparisons/save` - Save a comparison preset
- `GET /api/comparisons` - Get all saved comparisons
- `DELETE /api/comparisons/:id` - Delete a comparison

#### **New Frontend Components**

- `SessionControl.tsx` - Session start/stop controls with live timer and name prompt
- `SessionsList.tsx` - Browsable list of completed sessions with filtering
- `SessionDetailModal.tsx` - Detailed session view with editing capabilities
- `ComparisonWizard.tsx` - Multi-step comparison creation interface
- `ComparisonView.tsx` - Visual comparison results display with diffs
- `QuickPresets.tsx` - Quick-access comparison buttons for common comparisons

#### **Database Schema Updates**

- Added `sessions` table with fields:
  - `id`, `name`, `notes`
  - `started_at`, `ended_at`
  - `is_active`, `total_runs`, `total_duration`
  - `created_at` timestamp
- Added `comparisons` table for saved comparison presets

#### **Backend Modules Enhanced**

- `server.js`: Added session and comparison endpoints, improved organization
- `aggregator.js`: Already optimized with clean aggregation logic
- `db.js`: Already optimized with proper schema and indexes

### 📚 Documentation

- Updated README with Session Tracking & Comparison features
- Added comprehensive backend optimization documentation (`BACKEND_OPTIMIZATIONS.md`)
- Marked "Session tracking and comparison mode" as complete in Roadmap
- Updated download links to point to latest releases
- Added this CHANGELOG for version tracking

### 🎯 Version Numbering Convention

Going forward, version numbers follow semantic versioning:

- **Major releases** (X.0.0): Breaking changes or complete rewrites
- **Minor releases** (X.Y.0): New features and significant updates ← **This release**
- **Patch releases** (X.Y.Z): Bug fixes and small improvements

---

## [1.0.1] - Previous Release

### Bug Fixes

- Minor stability improvements
- UI refinements

---

## [1.0.0] - Initial Release

### Features

- Automatic CSV import from Kovaak's stats folder
- Real-time file watching for instant updates
- Performance tracking (Score, Accuracy, TTK, etc.)
- Auto-generated goal system
- Pack management with playlist imports
- Historical trend analysis
- Best settings tracking (DPI, sensitivity, FOV)
- First-launch setup wizard
- Settings persistence

---

**Made with ❤️ for the aim training community**