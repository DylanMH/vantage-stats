# Changelog

All notable changes to Vantage Stats will be documented in this file.

## [1.3.1] - 2025-12-20

### 🐛 Bug Fixes

#### **Today vs Yesterday Stats Comparison**

- Fixed critical timezone bug causing incorrect date comparisons on Profile page
- Issue: Runs were showing for "today" even when no runs were played that day
- Root cause: UTC timestamps in database weren't being converted to local time for date extraction
- Solution: Query now properly converts UTC timestamps to local timezone before date comparison
- Works correctly across all timezones without requiring data migration

### 🎨 UI/UX Improvements

#### **Themed Confirmation Dialogs**

- Replaced native browser `confirm()` dialogs with beautiful themed UI components
- Created `ConfirmDialog` component matching app theming
- Playlist deletion now uses in-app modal instead of system dialog
- Consistent visual experience across all confirmation prompts
- Proper styling with theme colors and smooth transitions

#### **Graph Display Enhancements**

- **TTK Graph Reversed**: Lower TTK values now correctly show graph going **down** (more intuitive)
  - Previously: Graph went up when TTK decreased (confusing)
  - Now: Graph goes down when TTK decreases (better = lower on graph)
  - Added "(Lower is Better)" label for clarity
- **Smoother Graph Lines**: Implemented weighted moving average algorithm
  - Increased smoothing window from 10 to 15 data points
  - Center points weighted more heavily for better trend representation
  - Eliminates choppy/jagged graph lines
  - Applied to all metrics: Score, Accuracy, and TTK

### ✨ New Features

#### **Session Task Breakdown Analysis**

- Added comprehensive task analysis to session detail view
- Shows per-task statistics within each session:
  - Number of runs per task
  - Average Score, Accuracy, and TTK per task
  - **Best Run** highlighting for each task with full metrics
- Tasks sorted by run count (most played first)
- Visual gradient highlighting for best runs
- Helps identify which scenarios you performed best in during training sessions

### 🔧 Configuration Changes

#### **Playlist Import Behavior**

- Removed automatic playlist import on every app launch
- Previously: Default playlists imported on every startup (causing duplicates)
- Now: Playlists only import when manually triggered by user
- Reduces startup time and prevents duplicate pack creation
- Users maintain full control over when playlists are imported

### 🛠️ Technical Details

#### **Backend Improvements**

- Enhanced `parseDateSafe()` to store dates in local time format
- Added `toLocalISOString()` helper for timezone-aware date formatting
- Updated `/api/runs/by-day` endpoint with proper timezone offset calculation
- SQLite `datetime()` modifier now correctly adjusts UTC to local time

#### **Frontend Components**

- New `ConfirmDialog.tsx` reusable confirmation component
- Enhanced `SessionDetailModal.tsx` with task breakdown calculations
- Optimized `ChartHost.tsx` with weighted moving average implementation
- Updated `Chart.tsx` TTK display logic

#### **Graph Algorithm**

- Weighted moving average with configurable window size
- Distance-based weighting: closer points have higher influence
- Maintains data integrity while smoothing visual presentation
- Adaptive to dataset size (requires minimum 3 points)

## [1.3.0] - 2025-12-19

### 🎯 Major Features

#### **Practice Mode Integration with Sessions**

- Sessions started in practice mode are now automatically tagged as practice sessions
- Practice sessions are visually indicated with 🎯 emoji badges in:
  - Session lists
  - Session detail modal headers
  - Comparison wizard session selectors
- Practice runs are properly filtered out from main stats and profile comparisons
- Added database migration to support `is_practice` column on sessions table

#### **Enhanced Practice Mode Toggle Protection**

- Toggling practice mode is now blocked when an active session is running
- Replaced generic error alerts with beautiful custom modal UI
- Modal displays:
  - Clear error message explaining why toggle is blocked
  - Active session name in highlighted box
  - User-friendly instructions to end session first
- Improved user experience with theme-consistent design

#### **Active Session Indicator in Navigation**

- Real-time session status now displayed in navigation bar
- Shows active session name (or "Session Active" as fallback)
- Blue pulsing badge indicator positioned next to practice mode badge
- Updates instantly when sessions start/end (no polling required)
- Separated from title link to prevent accidental navigation

### ⚡ Performance Improvements

#### **SessionContext Architecture**

- Created `SessionContext` for centralized session state management
- Implemented `useSession` hook following same pattern as `usePracticeMode`
- **Eliminated polling overhead** - previously made 30 API calls/minute
- Instant session state updates via direct context manipulation
- Consistent architecture across all context providers

#### **Optimized Data Fetching**

- Session indicator uses context instead of polling queries
- SessionControl component refactored to use context actions
- Reduced unnecessary API calls and network traffic
- Lower CPU usage and better battery life on laptops

### 🎨 UI/UX Improvements

#### **Navigation & Layout**

- Fixed navigation alignment to match content containers (max-width: 1600px)
- Improved spacing between title and status indicators
- Status indicators (practice mode + session) properly grouped
- Added full viewport height coverage (`minHeight: 100vh`) to prevent background bleed

#### **Profile Page Enhancements**

- Fixed profile page structure to always show Recent Tasks section
- Separated "Today vs Yesterday" comparison from Recent Tasks display
- Both sections now render independently (not as either/or fallback)
- Consistent dark gray background across all pages
- Eliminated unexpected blue gradient showing through

### 🛠️ Backend Improvements

#### **Practice Mode Filtering**

- Added `is_practice = 0` filter to `/api/runs/by-day` endpoint
- Profile page comparisons now properly exclude practice runs
- Consistent filtering across all stats endpoints
- Ensures practice runs don't contaminate main performance metrics

### 🐛 Bug Fixes

- Fixed session indicator not appearing until page reload (now instant via context)
- Fixed profile page showing empty blue background instead of content
- Fixed navigation title misalignment with content containers
- Fixed practice mode toggle allowing changes during active session
- Fixed profile page not displaying recent tasks section

### 🔧 Technical Details

#### **New Frontend Components & Hooks**

- `contexts/SessionContext.tsx` - Session state provider with instant updates
- `hooks/useSession.ts` - Custom hook for accessing session context
- Enhanced `PracticeModeContext.tsx` with custom error modal UI

#### **Database Schema Updates**

- Migration: `add_session_practice_mode.js` adds `is_practice` column to sessions table
- Added index on `is_practice` for faster filtering queries

#### **API Enhancements**

- `/api/sessions/start` now respects practice mode state and tags sessions accordingly
- `/api/sessions` endpoints filter runs based on session's practice flag
- `/api/practice/toggle` blocks toggle when active session exists with descriptive error
- `/api/runs/by-day` filters out practice runs for profile comparisons

#### **Type Safety**

- Updated `Session` type to include `is_practice: number` field
- Updated `is_active` type from `boolean` to `number` (SQLite compatibility)
- Fixed all session filtering logic to use explicit `=== 1` / `=== 0` comparisons

## [1.2.3] - 2025-12-14

### 🎨 More UI/UX Improvements

#### **Auto-Update Prompt UX**

- Update prompt now appears after the app UI finishes loading (no longer blocks startup)
- Simplified the update dialog content (no raw HTML release notes)

## [1.2.2] - 2025-12-14

### 🎨 UI/UX Improvements

#### **Settings: Updates & Version Display**

- Settings now displays the real installed app version (no more hardcoded version string)
- Added a manual “Check for updates” button in Settings

## [1.2.1] - 2025-12-14

### ⚙️ App Updates

#### **GitHub Releases Auto-Update Support**

- Added support for checking GitHub Releases for updates on app launch (installed builds)
- Added a Settings link to view the latest release on GitHub

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
