import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import Profile from "./pages/Profile";
import Stats from "./pages/Stats";
import Goals from "./pages/Goals";
import Sessions from "./pages/Sessions";
import Settings from "./pages/Settings";
import Practice from "./pages/Practice";
import Ranked from "./pages/Ranked";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { PracticeModeProvider } from "./contexts/PracticeModeContext";
import { SessionProvider } from "./contexts/SessionContext";
import GoalNotification from "./components/GoalNotification";
import UpdateDialog from "./components/UpdateDialog";
import { useGoalNotifications } from "./hooks/useGoalNotifications";
import { useRealtimeUpdates } from "./hooks/useRealtimeUpdates";

// Dashboard component for the root route - now shows Profile
function Dashboard() {
  return <Profile />;
}

function AppContent() {
  const { notifications, dismissNotification } = useGoalNotifications();

  // Listen for real-time updates from backend
  useRealtimeUpdates(() => {
    // Dispatch custom event that components can listen to
    window.dispatchEvent(new CustomEvent('data-updated'));
  });

  return (
    <div style={{ backgroundColor: 'var(--color-bg-primary, #0b0f14)', minHeight: '100vh' }}>
      <Nav />
      <main className="max-w-[1600px] mx-auto px-4 pt-8 pb-12">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/ranked" element={<Ranked />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      
      {/* Goal Achievement Notifications */}
      <div className="fixed top-0 right-0 z-50 flex flex-col gap-2 p-4">
        {notifications.map((goal, index) => (
          <div key={goal.id} style={{ marginTop: `${index * 10}px` }}>
            <GoalNotification
              goal={goal}
              onClose={() => dismissNotification(goal.id)}
            />
          </div>
        ))}
      </div>

      {/* Update Dialog */}
      <UpdateDialog />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PracticeModeProvider>
        <SessionProvider>
          <Router>
            <AppContent />
          </Router>
        </SessionProvider>
      </PracticeModeProvider>
    </ThemeProvider>
  );
}
