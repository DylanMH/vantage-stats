// frontend/src/components/EmptyState.tsx
export default function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-[16px] border border-[#222838] bg-[#161a22] p-7 text-center opacity-80 shadow-lg">
            {text}
        </div>
    );
}
