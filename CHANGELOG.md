# Changelog

All notable changes to Vantage Stats will be documented in this file.

## [1.3.7] - 2025-12-28

### Small Fixes

- Added database cleanup script to remove unused columns from users table
- Added duplicate name validation to pack creation endpoint
- Added default value for playlists_folder setting in settings.json

## [1.3.6] - 2025-12-27

### Small Startup Fixes

- Added automatic playlist import on app startup when auto_import_playlists setting is enabled
- Moved playlist auto-import to run after initial CSV scan in both normal startup and setup completion flows
- Removed unused packs service import from main.js
- Changed default window size from 1920x1080 to 900x900 for better initial UX
- Fixed release notes display in UpdateDialog by stripping HTML tags and using proper markdown parsing

## [1.3.5] - 2025-12-20

### 🏗️ Backend Architecture Refactoring

#### **Complete Backend Reorganization**

- Restructured entire backend for better maintainability and performance
- Created organized directory structure:
  - `config/` - Database, server, and migration configuration
  - `core/` - Business logic (data-import, aggregation, goals)
  - `services/` - Business services (packs, settings)
  - `utils/` - Pure utility functions (time, hash, events)
- Moved 15+ files to appropriate locations with updated import paths
- Eliminated 40%+ duplicate code across the codebase

#### **Code Consolidation & Optimization**

- Consolidated 6 duplicate `daysAgoIso()` functions into single `utils/time.js` utility
- Consolidated duplicate `toLocalISOString()` functions across 3+ files
- Consolidated duplicate `resolveWindow()` function from aggregator
- Consolidated duplicate `sha1()` and `hashFile()` functions into `utils/hash.js`
- Removed redundant files: `timeUtils.js`, `backfill.js`
- Updated all 28 affected files with corrected import paths
- Single source of truth for all utility functions

#### **Memory & Performance Improvements**

- Reduced memory footprint by eliminating duplicate function definitions
- Better tree-shaking potential with modular structure
- Improved code discoverability and navigation
- Clear separation of concerns for easier maintenance

### 🎨 Session Comparison UX Overhaul

#### **Persistent Comparison Selector**

- Added always-visible comparison selector at top of Sessions page
- Auto-selects two most recent sessions for instant comparison
- Swap button (⇄) to quickly reverse left/right positions
- No wizard required - just select and compare
- Direct integration with main Sessions page workflow

#### **Quick Comparison Modal**

- Click "Compare" on any session card → instant modal with that session pre-selected
- Smart default selection for right side:
  - Picks next session below if available
  - Falls back to session above if it's the last one
  - Intelligent positioning for best UX
- Both sides have full dropdowns for complete flexibility
- Cleaner, faster flow than full wizard

#### **Session Selector Edge Case Handling**

- Prevents selecting the same session on both sides
- Auto-corrects when duplicate selection detected
- Compare button disabled when sessions are identical
- Works bidirectionally (changing either side triggers correction)
- Foolproof protection against invalid comparisons

#### **Modal UI Polish**

- Perfectly symmetrical layout with equal-width dropdowns
- Fixed height elements (48px) for consistent alignment
- Increased modal width (`max-w-5xl`) for better readability
- Clean spacing with proper gaps and padding
- Full session names visible without truncation
- Professional, polished appearance

#### **ComparisonView Cleanup**

- Removed redundant session selector from comparison results
- Users now use persistent selector on Sessions page instead
- Cleaner results view focused on analysis
- Reduced UI clutter and confusion
- Comparison results show static labels (no more duplicate controls)
- Better spacing between Compare and Close buttons

### 🐛 Bug Fixes

- Fixed session comparison modal left/right asymmetry issues
- Fixed overflow of colored indicator bars outside modal card
- Fixed text truncation preventing full session names from displaying
- Resolved import path errors after backend refactoring
- Fixed missing `fs/promises` import in watcher module
- Fixed settings import paths in practice.js and sessions.js routes

### 🔧 Technical Details

#### **New Backend Structure**

```
backend/
├── config/          # DB, server, migrations
├── core/            # Business logic
│   ├── data-import/ # CSV parsing, file watching
│   ├── aggregation/ # Stats engine
│   └── goals/       # Goal management
├── services/        # Packs, settings
├── utils/           # Time, hash, events
└── routes/          # API endpoints
```

#### **New Components**

- `SessionComparisonSelector.tsx` - Persistent dropdown selector
- `QuickComparisonModal.tsx` - One-click comparison modal

#### **Files Relocated** (15+ files)

- `db.js` → `config/database.js`
- `server.js` → `config/server.js`
- `csvParser.js` → `core/data-import/csvParser.js`
- `watcher.js` → `core/data-import/watcher.js`
- `aggregator.js` → `core/aggregation/aggregator.js`
- `goals.js` → `core/goals/goals.js`
- `packs.js` → `services/packs.js`
- `settings.js` → `services/settings.js`
- And 7+ more files reorganized

#### **Import Path Updates**

- All route files updated to use new service/util paths
- Main entry point (`electron/main.js`) updated
- Backend circular dependencies resolved
- Cleaner, more maintainable import structure

---

## [1.3.4] - 2025-12-20

### 🎨 UI/UX Improvements

#### **Navigation Bar Enhancements**

- Fixed sticky navigation behavior - nav now properly stays at top when scrolling
- Added backdrop blur effect with 90% opacity for modern frosted glass appearance
- Removed `overflow-x: hidden` from body CSS that was preventing sticky positioning
- Nav background matches theme-secondary color for consistent theming

#### **Icon Component Refactoring**

- Extracted hardcoded SVG icons from UpdateDialog into reusable icon components
- Created `CloudDownloadIcon`, `DocumentIcon`, and `DownloadIcon` components
- Cleaner code structure and easier icon maintenance

#### **Goal Deletion Dialog**

- Replaced native browser `confirm()` with themed `ConfirmDialog` component in Goals page
- Consistent with app theming and better user experience
- Shows goal name in confirmation message for clarity

### 🐛 Bug Fixes

#### **Goal Creation Backend Fix**

- Fixed 500 error when creating task-specific and pack-specific goals
- Issue: Backend was trying to insert into non-existent columns
- Solution: Aligned INSERT statement with actual database schema
- Properly creates goal_progress entries separately from goals table

## [1.3.3] - 2025-12-20

### 🐛 Bug Fixes

#### **Logo Asset Loading in Production Builds**

- Fixed logo failing to load in GitHub Actions builds (ERR_FILE_NOT_FOUND)
- Issue: Direct path reference `/vs-icon-logo.png` wasn't being processed by Vite build
- Solution: Changed to module import so Vite properly bundles and hashes the asset
- Logo now loads correctly in all production builds

### 🎨 UI/UX Improvements

#### **Session Deletion Confirmation**

- Replaced native browser `confirm()` dialog with themed `ConfirmDialog` component
- Session deletion now uses consistent in-app modal matching application theme
- Shows session name in confirmation message for clarity
- Provides "Delete" and "Cancel" buttons with danger styling

## [1.3.2] - 2025-12-20

### 🎨 UI/UX Improvements

#### **Comparison View Enhancements**

- **Consistent Color Coding**: Overhauled comparison UI with clear visual distinction
  - Blue text/borders for left session throughout all cards
  - Green text/borders for right session throughout all cards
  - Lime-green for improvement indicators (better contrast with session colors)
  - Red for decline indicators
  - Removed opacity/fading from left session values for better readability

- **Improved Layout & Clarity**:
  - Overall Performance cards: Diff indicators positioned in center between values
  - Task-Specific Breakdown: Diff indicators aligned under right session value for clarity
  - Removed colored dots from session labels for cleaner look
  - Enhanced session dropdown spacing with better padding and visual breathing room
  - Larger, more readable dropdowns with improved color-coded borders

### 🐛 Bug Fixes

#### **Session Comparison Switcher**

- Fixed 500 error when switching between sessions in comparison view
- Issue: Missing session IDs in comparison metadata for shared task path
- Solution: Added session ID assignment to early return path in comparisons endpoint
- Session dropdowns now work smoothly without errors

#### **Electron IPC & TypeScript Configuration**

- Fixed "An object could not be cloned" IPC error on app launch
- Removed problematic `executeJavaScript` injection causing circular references
- Updated frontend to use direct `require('electron')` with proper try-catch handling
- Installed `@types/node` and updated tsconfig for proper Node.js type definitions
- Resolved TypeScript errors for `require()` in Electron context

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
