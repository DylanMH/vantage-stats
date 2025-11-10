import { Link, useLocation } from "react-router-dom";

export default function Nav() {
    const location = useLocation();
    
    const getNavLinkClass = (path: string) => {
        const isActive = location.pathname === path;
        return isActive 
            ? "px-3 py-1.5 rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary"
            : "px-3 py-1.5 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-primary transition-colors";
    };

    return (
        <nav className="sticky top-0 z-40 -mx-4 mb-4 px-4 py-3 backdrop-blur border-b border-theme-primary" style={{ backgroundColor: 'var(--color-bg-primary)80' }}>
            <div className="max-w-[1160px] mx-auto flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2 font-bold tracking-wide text-theme-primary hover:text-theme-accent transition-colors">
                    <img src="./vs-icon-logo.png" alt="Vantage Stats" className="w-8 h-8" />
                    <span>Vantage Stats</span>
                </Link>
                <div className="flex gap-2 text-sm">
                    <Link to="/" className={getNavLinkClass("/")}>
                        Profile
                    </Link>
                    <Link to="/stats" className={getNavLinkClass("/stats")}>
                        Stats
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
