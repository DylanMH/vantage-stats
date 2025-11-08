import { Link, useLocation } from "react-router-dom";

export default function Nav() {
    const location = useLocation();
    
    const getNavLinkClass = (path: string) => {
        const isActive = location.pathname === path;
        return isActive 
            ? "px-3 py-1.5 rounded-lg border border-[#1b2440] bg-[#0d1424] text-white"
            : "px-3 py-1.5 rounded-lg hover:bg-[#0f1422] text-[#9aa4b2] hover:text-white";
    };

    return (
        <nav className="sticky top-0 z-40 -mx-4 mb-4 px-4 py-3 backdrop-blur bg-black/40 border-b border-[#222838]">
            <div className="max-w-[1160px] mx-auto flex items-center justify-between">
                <Link to="/" className="font-bold tracking-wide text-white hover:text-blue-400 transition-colors">
                    Kovaaks Insight
                </Link>
                <div className="flex gap-2 text-sm">
                    <Link to="/" className={getNavLinkClass("/")}>
                        Profile
                    </Link>
                    <Link to="/stats" className={getNavLinkClass("/stats")}>
                        Stats
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
