import React from "react";
import Card from "./Card";

export default function Section({
    title,
    action,
    className = "",
    children,
}: {
    title: string;
    action?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <Card className={`p-4 ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[#cdd9e5]">{title}</h2>
                {action}
            </div>
            {children}
        </Card>
    );
}
