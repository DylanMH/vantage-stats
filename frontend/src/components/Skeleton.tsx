// frontend/src/components/Skeleton.tsx
export function Skeleton({ h = 16, w = 120 }: { h?: number; w?: number }) {
    return (
        <div
            style={{ height: h, width: w }}
            className="rounded-lg bg-gradient-to-r from-[#121621] via-[#161b27] to-[#121621] animate-pulse"
        />
    );
}
