// frontend/src/components/Layout.tsx
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#0f1115] text-[#e6edf3]">
            <nav className="flex justify-between items-center px-4 py-3 border-b border-[#222838] bg-[#0d1016]">
                <div className="font-bold">Kovaaks Insight</div>
                <div className="flex gap-2">
                    <a className="px-3 py-1.5 rounded border border-[#1b2440] bg-[#0d1424]">Dashboard</a>
                    <a className="px-3 py-1.5 rounded hover:bg-[#0f1422]">Stats</a>
                    <a className="px-3 py-1.5 rounded text-[#9aa4b2] pointer-events-none opacity-60">Coach</a>
                    <a className="px-3 py-1.5 rounded text-[#9aa4b2] pointer-events-none opacity-60">Goals</a>
                </div>
            </nav>
            <main className="max-w-[1160px] mx-auto px-4 py-6">{children}</main>
            <footer className="text-center py-3 border-t border-[#222838] opacity-55 text-sm">Local • sqlite3 • Electron</footer>
        </div>
    );
}
