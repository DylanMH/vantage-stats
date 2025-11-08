# Contributing to Kovaak's Insight

Thank you for your interest in contributing to Kovaak's Insight! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
   ```bash
   git clone https://github.com/YOUR_USERNAME/kovaaks-insight.git
   cd kovaaks-insight
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Create a branch** for your feature
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 💻 Development Setup

### Running the App in Development

```bash
# Terminal 1 - Start frontend dev server
npm run dev

# Terminal 2 - Start Electron
npm start
```

### Building for Production

```bash
# Build frontend and start
npm run build:start

# Package for distribution
npm run dist
```

## 📝 Code Guidelines

### General Principles

- **Keep it simple**: Write clear, maintainable code
- **Type safety**: Use TypeScript for type checking
- **Comments**: Add comments for complex logic
- **Consistency**: Follow existing code patterns and conventions

### TypeScript/React Guidelines

- Use functional components with hooks
- Prefer `const` over `let` when possible
- Use descriptive variable names (e.g., `handleImportPlaylist` instead of `handleImport`)
- Event handlers should be prefixed with `handle` (e.g., `handleClick`, `handleSubmit`)
- Use TailwindCSS for styling (avoid inline styles or CSS modules)

### File Organization

```
frontend/src/
├── components/     # Reusable UI components
├── pages/         # Full page components
├── hooks/         # Custom React hooks
└── utils/         # Helper functions

backend/
├── server.js      # Express API routes
├── csvParser.js   # CSV parsing logic
├── watcher.js     # File system watching
├── goals.js       # Goal generation
└── db.js          # Database utilities
```

### Naming Conventions

- **Components**: PascalCase (e.g., `TaskDetailModal.tsx`)
- **Files**: camelCase for utilities (e.g., `csvParser.js`)
- **Functions**: camelCase (e.g., `fetchChartData`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Types/Interfaces**: PascalCase (e.g., `ChartData`, `UserProfile`)

## 🧪 Testing

Before submitting a PR:

1. Test the app in development mode
2. Build and test in production mode
3. Test with various Kovaak's CSV formats
4. Check that the database migrations work correctly
5. Verify the Electron build works on Windows

## 📤 Submitting Changes

1. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```

2. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub

### Commit Message Format

Use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add playlist import functionality
fix: correct chart time direction
docs: update README with installation steps
refactor: simplify goal calculation logic
```

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear description of the issue
2. **Steps to reproduce**: How to trigger the bug
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Screenshots**: If applicable
6. **Environment**: OS version, Node.js version, etc.

## 💡 Feature Requests

Feature requests are welcome! Please provide:

1. **Use case**: Why is this feature needed?
2. **Description**: What should the feature do?
3. **Mockups**: If applicable, include design ideas

## 🔧 Areas for Contribution

Some areas where contributions are especially welcome:

- **UI/UX improvements**: Better layouts, animations, themes
- **Performance optimizations**: Faster data processing, chart rendering
- **New features**: Additional statistics, export options, comparisons
- **Bug fixes**: Resolve issues from the issue tracker
- **Documentation**: Improve README, add guides, code comments
- **Testing**: Add test coverage, manual testing feedback

## 📞 Questions?

If you have questions about contributing, feel free to:

- Open a [GitHub Discussion](https://github.com/yourusername/kovaaks-insight/discussions)
- Comment on an existing issue
- Reach out to the maintainers

## ✅ Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help maintain a welcoming community

Thank you for contributing to Kovaak's Insight! 🎯
