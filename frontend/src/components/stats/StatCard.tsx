import Card from "../ui/Card";

export default function StatCard({
    label,
    value,
    sub = "",
}: {
    label: string;
    value: string | number;
    sub?: string;
}) {
    return (
        <Card className="p-4">
            <div className="text-[--color-muted] font-semibold">{label}</div>
            <div className="mt-1 text-3xl font-extrabold leading-tight">{value}</div>
            {sub && <div className="text-xs text-[--color-muted] mt-1">{sub}</div>}
        </Card>
    );
}
