import Section from "../ui/Section";
import { formatScore, formatWhen } from "../../utils/format";

export type TaskRow = {
    task: string;
    runs: number;
    avgAcc: number | null;
    avgScore: number | null;
    avgShots?: number | null;
    avgHits?: number | null;
    avgTtk?: number | null;
    avgDuration?: number | null;
    avgOvershots?: number | null;
    maxScore?: number | null;
    lastPlayed: string | null;
};

export default function TasksTable({
    rows,
    onFilter,
    onSelectTask,
    hideFilter = false,
}: {
    rows: TaskRow[];
    onFilter?: (q: string) => void;
    onSelectTask?: (taskName: string) => void;
    hideFilter?: boolean;
}) {
    const handleViewTask = (taskName: string) => {
        // Instead of opening modal, trigger the filter
        onSelectTask?.(taskName);
    };

    return (
        <>
            <Section
                title="Tasks"
                action={
                    !hideFilter && onFilter ? (
                        <input
                            placeholder="Filter tasks..."
                            onChange={(e) => onFilter(e.target.value)}
                            className="w-60 max-w-full bg-[#0f1320] border border-[--color-border] text-[--color-text] px-3 py-1.5 rounded-lg outline-none"
                        />
                    ) : undefined
                }
            >
                <div className="overflow-auto">
                    <table className="w-full border-separate border-spacing-0">
                        <thead className="sticky top-0 bg-[#151a22]">
                            <tr className="[&>th]:text-left [&>th]:py-2 [&>th]:px-2 [&>th]:border-b [&>th]:border-[#1d2230] text-sm">
                                <th>Task</th>
                                <th>Runs</th>
                                <th>Avg Acc</th>
                                <th>Avg Score</th>
                                <th>Last Played</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody className="[&>tr:hover]:bg-[#111623] [&>tr>td]:py-2 [&>tr>td]:px-2 [&>tr>td]:border-b [&>tr>td]:border-[#1d2230] text-sm">
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-[--color-muted]">
                                        No tasks found.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, i) => (
                                <tr key={i}>
                                    <td className="max-w-[520px] truncate">{r.task}</td>
                                    <td>{r.runs}</td>
                                    <td>{r.avgAcc !== null ? `${r.avgAcc.toFixed(1)}%` : "—"}</td>
                                    <td>{formatScore(r.avgScore)}</td>
                                    <td className="whitespace-nowrap">
                                        {r.lastPlayed ? formatWhen(r.lastPlayed) : "—"}
                                    </td>
                                    <td className="text-right">
                                        <button 
                                            onClick={() => handleViewTask(r.task)}
                                            className="px-2 py-1 rounded-lg border border-[--color-border] text-[#7cc0ff] hover:bg-[#0f1422] text-sm transition-colors"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>
        </>
    );
}
