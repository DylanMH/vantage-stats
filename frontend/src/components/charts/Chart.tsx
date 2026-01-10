import { useState } from "react";

type ChartProps = {
    data: Array<{ value: number; date: string }>;
    color: string;
    label: string;
    inverted?: boolean; // For TTK where lower is better
    onPointClick?: (date: string) => void; // Callback when point is clicked
};

export default function Chart({ data, color, label, inverted = false, onPointClick }: ChartProps) {
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

    if (data.length === 0) return null;

    // Filter out invalid data points (NaN, null, undefined)
    const validData = data.filter(d => typeof d.value === 'number' && !isNaN(d.value) && isFinite(d.value));
    
    if (validData.length === 0) return null;

    // Reverse data so oldest is on the left, newest on the right
    const reversedData = [...validData].reverse();

    const values = reversedData.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    const points = reversedData.map((d, i) => {
        // Handle single data point case - place it in the middle
        const x = reversedData.length === 1 ? 200 : (i / (reversedData.length - 1)) * 400;
        const normalizedValue = (d.value - minValue) / range;
        const y = inverted ? normalizedValue * 100 : 100 - normalizedValue * 100;
        return { x, y, value: d.value, date: d.date };
    });

    return (
        <div className="relative">
            <svg 
                className="w-full h-full cursor-crosshair" 
                viewBox="0 0 400 100" 
                preserveAspectRatio="none"
                onMouseLeave={() => setHoveredPoint(null)}
            >
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map(y => (
                    <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#1d2230" strokeWidth="0.5" />
                ))}
                
                {/* Line */}
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    points={points.map(p => `${p.x},${p.y}`).join(' ')}
                />
                
                {/* Interactive points */}
                {points.map((point, i) => (
                    <g key={i}>
                        {/* Invisible larger hit area */}
                        <circle
                            cx={point.x}
                            cy={point.y}
                            r="8"
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredPoint(i)}
                            onClick={() => onPointClick?.(point.date)}
                        />
                        {/* Visible dot on hover */}
                        {hoveredPoint === i && (
                            <circle
                                cx={point.x}
                                cy={point.y}
                                r="4"
                                fill={color}
                                stroke="#fff"
                                strokeWidth="2"
                            />
                        )}
                    </g>
                ))}
            </svg>
            
            {/* Tooltip */}
            {hoveredPoint !== null && (
                <div 
                    className="absolute z-10 bg-[#1a1f2e] border border-[#2d3561] rounded-lg px-3 py-2 pointer-events-none shadow-xl"
                    style={{
                        left: `${(hoveredPoint / (reversedData.length - 1)) * 100}%`,
                        top: '-60px',
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div className="text-xs font-semibold text-white mb-1">{label}</div>
                    <div className="text-sm font-bold" style={{ color }}>
                        {typeof points[hoveredPoint].value === 'number' && points[hoveredPoint].value < 10
                            ? points[hoveredPoint].value.toFixed(3)
                            : points[hoveredPoint].value.toLocaleString()}
                        {label.includes('Accuracy') ? '%' : label.includes('TTK') ? 's' : ''}
                    </div>
                    <div className="text-xs text-[#9aa4b2] mt-1">
                        {new Date(points[hoveredPoint].date).toLocaleDateString()}
                    </div>
                </div>
            )}
        </div>
    );
}
