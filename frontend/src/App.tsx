import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import Profile from "./pages/Profile";
import Stats from "./pages/Stats";
import Goals from "./pages/Goals";
import Settings from "./pages/Settings";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";

// Dashboard component for the root route - now shows Profile
function Dashboard() {
  return <Profile />;
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary, #0b0f14)' }}>
          <Nav />
          <main className="max-w-[1600px] mx-auto px-4 my-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}
