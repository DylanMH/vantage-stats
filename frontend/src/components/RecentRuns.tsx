import Section from "./ui/Section";
import { formatScore, formatWhen } from "../utils/format";

export type RunRow = {
    id: number;
    task: string;
    accuracy: number | null;  // 0..1 from backend -> we render %
    score: number | null;
    shots: number | null;
    played_at: string;        // ISO string
};

export default function RecentRuns({ rows }: { rows: RunRow[] }) {
    return (
        <Section title="Recent runs">
            <div className="overflow-auto">
                <table className="w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 bg-[#151a22]">
                        <tr className="[&>th]:text-left [&>th]:py-2 [&>th]:px-2 [&>th]:border-b [&>th]:border-[#1d2230] text-sm">
                            <th>When</th>
                            <th>Task</th>
                            <th>Acc %</th>
                            <th>Score</th>
                            <th>Shots</th>
                        </tr>
                    </thead>
                    <tbody className="[&>tr:hover]:bg-[#111623] [&>tr>td]:py-2 [&>tr>td]:px-2 [&>tr>td]:border-b [&>tr>td]:border-[#1d2230] text-sm">
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-[--color-muted]">
                                    No runs yet.
                                </td>
                            </tr>
                        )}
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td className="whitespace-nowrap">{formatWhen(r.played_at)}</td>
                                <td className="max-w-[340px] truncate">{r.task}</td>
                                <td>{(r.accuracy)}</td>
                                <td>{formatScore(r.score)}</td>
                                <td>{r.shots ?? "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Section>
    );
}
