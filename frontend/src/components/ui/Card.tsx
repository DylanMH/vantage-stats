import React from "react";

type Props = React.PropsWithChildren<{ className?: string }>;

export default function Card({ className = "", children }: Props) {
    return (
        <div
            className={`rounded-[16px] border border-[#222838] bg-[#161a22] shadow-lg ${className}`}
        >
            {children}
        </div>
    );
}
