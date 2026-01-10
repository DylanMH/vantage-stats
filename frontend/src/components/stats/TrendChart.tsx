// frontend/src/components/TrendChart.tsx
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip,
} from "chart.js";
import type { Run } from "../../types";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip);

export default function TrendChart({ runs, title }: { runs: Run[]; title: string }) {
    const labels = runs.map((r) => new Date(r.played_at).toLocaleString());
    const data = runs.map((r) => r.accuracy ?? null);

    return (
        <div className="rounded-[16px] border border-[#222838] bg-[#161a22] p-4 shadow-lg">
            <div className="text-sm font-semibold text-[#cdd9e5] mb-3">{title}</div>
            <Line
                data={{
                    labels,
                    datasets: [{ label: "Accuracy (%)", data, tension: 0.25 }],
                }}
                options={{
                    plugins: { legend: { labels: { color: "#cdd9e5" } } },
                    scales: {
                        x: { ticks: { color: "#9aa4b2" }, grid: { color: "#222838" } },
                        y: { ticks: { color: "#9aa4b2" }, grid: { color: "#222838" } },
                    },
                }}
            />
        </div>
    );
}
