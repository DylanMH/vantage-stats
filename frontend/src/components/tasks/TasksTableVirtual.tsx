import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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

export default function TasksTableVirtual({
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
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45, // Estimated row height
        overscan: 5, // Render 5 extra rows above/below viewport
    });

    const handleViewTask = (taskName: string) => {
        onSelectTask?.(taskName);
    };

    return (
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
            <div
                ref={parentRef}
                className="overflow-auto"
                style={{ height: '600px' }}
            >
                <table className="w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 bg-[#151a22] z-10">
                        <tr className="[&>th]:text-left [&>th]:py-2 [&>th]:px-2 [&>th]:border-b [&>th]:border-[#1d2230] text-sm">
                            <th>Task</th>
                            <th>Runs</th>
                            <th>Avg Acc</th>
                            <th>Avg Score</th>
                            <th>Last Played</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-[--color-muted]">
                                    No tasks found.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {/* Spacer for virtual scroll offset */}
                                <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px` }} />
                                
                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const row = rows[virtualRow.index];
                                    return (
                                        <tr
                                            key={virtualRow.index}
                                            data-index={virtualRow.index}
                                            ref={rowVirtualizer.measureElement}
                                            className="hover:bg-[#111623] [&>td]:py-2 [&>td]:px-2 [&>td]:border-b [&>td]:border-[#1d2230] text-sm"
                                        >
                                            <td className="max-w-[520px] truncate">{row.task}</td>
                                            <td>{row.runs}</td>
                                            <td>{row.avgAcc !== null ? `${row.avgAcc.toFixed(1)}%` : "—"}</td>
                                            <td>{formatScore(row.avgScore)}</td>
                                            <td className="whitespace-nowrap">
                                                {row.lastPlayed ? formatWhen(row.lastPlayed) : "—"}
                                            </td>
                                            <td className="text-right">
                                                <button
                                                    onClick={() => handleViewTask(row.task)}
                                                    className="px-2 py-1 rounded-lg border border-[--color-border] text-[#7cc0ff] hover:bg-[#0f1422] text-sm transition-colors"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                
                                {/* Bottom spacer */}
                                <tr style={{ 
                                    height: `${
                                        rowVirtualizer.getTotalSize() - 
                                        (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)
                                    }px` 
                                }} />
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </Section>
    );
}
