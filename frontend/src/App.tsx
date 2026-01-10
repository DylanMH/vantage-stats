import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Nav from "./components/layout/Nav";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { PracticeModeProvider } from "./contexts/PracticeModeContext";
import { SessionProvider } from "./contexts/SessionContext";
import GoalNotification from "./components/goals/GoalNotification";
import UpdateDialog from "./components/feedback/UpdateDialog";
import { useGoalNotifications } from "./hooks/useGoalNotifications";
import { useRealTimeUpdates } from "./hooks/useRealTimeUpdates";

// Lazy load page components for code splitting
const Profile = lazy(() => import("./pages/Profile"));
const Stats = lazy(() => import("./pages/Stats"));
const Goals = lazy(() => import("./pages/Goals"));
const Sessions = lazy(() => import("./pages/Sessions"));
const Settings = lazy(() => import("./pages/Settings"));
const Practice = lazy(() => import("./pages/Practice"));
const Ranked = lazy(() => import("./pages/Ranked"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-theme-accent border-t-transparent mb-4"></div>
        <p className="text-theme-muted">Loading...</p>
      </div>
    </div>
  );
}

// Dashboard component for the root route - now shows Profile
function Dashboard() {
  return <Profile />;
}

function AppContent() {
  const { notifications, dismissNotification } = useGoalNotifications();

  // Listen for real-time updates from backend
  useRealTimeUpdates({
    onNewRun: () => {
      // Dispatch custom event that components can listen to
      window.dispatchEvent(new CustomEvent('data-updated'));
    },
    onConnect: () => {
      console.log('📡 Real-time updates connected globally');
    },
    onError: (error: Event) => {
      console.error('❌ Real-time updates error:', error);
    }
  });

  return (
    <div style={{ backgroundColor: 'var(--color-bg-primary, #0b0f14)', minHeight: '100vh' }}>
      <Nav />
      <main className="max-w-[1600px] mx-auto px-4 pt-8 pb-12">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/ranked" element={<Ranked />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
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
