import { Link, useLocation } from "react-router-dom";
import { usePracticeMode } from "../hooks/usePracticeMode";
import { useSession } from "../hooks/useSession";

export default function Nav() {
    const location = useLocation();
    const { isPracticeMode } = usePracticeMode();
    const { activeSession } = useSession();
    
    const getNavLinkClass = (path: string) => {
        const isActive = location.pathname === path;
        return isActive 
            ? "px-3 py-1.5 rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary"
            : "px-3 py-1.5 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-primary transition-colors";
    };

    return (
        <nav className="sticky top-0 z-40 -mx-4 mb-4 px-4 py-3 backdrop-blur border-b border-theme-primary" style={{ backgroundColor: 'var(--color-bg-primary)80' }}>
            <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-2 font-bold tracking-wide text-theme-primary hover:text-theme-accent transition-colors">
                        <img src="./vs-icon-logo.png" alt="Vantage Stats" className="w-8 h-8" />
                        <span>Vantage Stats</span>
                    </Link>
                    
                    {/* Status Indicators */}
                    {(isPracticeMode || activeSession) && (
                        <div className="flex items-center gap-2">
                            {isPracticeMode && (
                                <span className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs font-semibold text-green-400">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                    Practice Mode
                                </span>
                            )}
                            {activeSession && (
                                <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs font-semibold text-blue-400">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                                    {activeSession.name || 'Session Active'}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex gap-2 text-sm">
                    <Link to="/" className={getNavLinkClass("/")}>
                        Profile
                    </Link>
                    <Link to="/stats" className={getNavLinkClass("/stats")}>
                        Stats
                    </Link>
                    <Link to="/practice" className={getNavLinkClass("/practice")}>
                        Practice
                    </Link>
                    <Link to="/sessions" className={getNavLinkClass("/sessions")}>
                        Sessions
                    </Link>
                    <Link to="/goals" className={getNavLinkClass("/goals")}>
                        Goals
                    </Link>
                    <Link to="/settings" className={getNavLinkClass("/settings")}>
                        Settings
                    </Link>
                </div>
            </div>
        </nav>
    );
}
