import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/localApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toMmol } from '@/utils/bgUnits';
import { Target, TrendingUp } from 'lucide-react';

const TIR_GOAL = 70;

function computeTIR(readings, settings) {
    if (!readings?.length || !settings) return null;
    const isMmol = (settings?.bg_unit ?? 'mmol') === 'mmol';
    const low = settings.low_threshold ?? (isMmol ? 3.9 : 70);
    const high = settings.high_threshold ?? (isMmol ? 10 : 180);

    const getDisplay = (r) => isMmol ? toMmol(r.glucose_value) : r.glucose_value;

    const inRange = (r) => {
        const v = getDisplay(r);
        return v >= low && v <= high;
    };
    const below = (r) => getDisplay(r) < low;
    const above = (r) => getDisplay(r) > high;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const todayReadings = readings.filter((r) => new Date(r.timestamp) >= todayStart);
    const weekReadings = readings.filter((r) => new Date(r.timestamp) >= weekStart);

    const calc = (arr) => {
        if (arr.length === 0) return { inRange: 0, below: 0, above: 0, total: 0, pct: null };
        const inR = arr.filter(inRange).length;
        const bel = arr.filter(below).length;
        const abv = arr.filter(above).length;
        return {
            inRange: inR,
            below: bel,
            above: abv,
            total: arr.length,
            pct: Math.round((inR / arr.length) * 100),
        };
    };

    return {
        today: calc(todayReadings),
        week: calc(weekReadings),
        low,
        high,
        unit: isMmol ? 'mmol/L' : 'mg/dL',
    };
}

export default function TimeInRangeCard() {
    const { data: readings = [] } = useQuery({
        queryKey: ['bgReadings', 'tir'],
        queryFn: () => api.getReadings(500),
    });
    const { data: settings } = useQuery({
        queryKey: ['alertSettings'],
        queryFn: () => api.getSettings(),
    });

    const tir = computeTIR(readings, settings);
    if (!tir || (tir.today.total === 0 && tir.week.total === 0)) return null;

    const chartData = [
        { name: 'Today', inRange: tir.today.inRange, below: tir.today.below, above: tir.today.above, pct: tir.today.pct },
        { name: 'This Week', inRange: tir.week.inRange, below: tir.week.below, above: tir.week.above, pct: tir.week.pct },
    ];

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Time in Range
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                    Target: {tir.low}–{tir.high} {tir.unit} (Goal: {TIR_GOAL}%)
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-xl bg-green-50 border border-green-200/50">
                        <p className="text-3xl font-bold text-green-600">
                            {tir.today.pct ?? '—'}%
                        </p>
                        <p className="text-sm text-gray-600 mt-1">Today</p>
                        <p className="text-xs text-gray-500">{tir.today.total} readings</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-blue-50 border border-blue-200/50">
                        <p className="text-3xl font-bold text-blue-600">
                            {tir.week.pct ?? '—'}%
                        </p>
                        <p className="text-sm text-gray-600 mt-1">This Week</p>
                        <p className="text-xs text-gray-500">{tir.week.total} readings</p>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                    {(tir.today.pct ?? 0) >= TIR_GOAL || (tir.week.pct ?? 0) >= TIR_GOAL ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <TrendingUp className="w-4 h-4" />
                            Meeting goal
                        </span>
                    ) : (
                        <span className="text-amber-600 text-sm">
                            Aim for {TIR_GOAL}%+ time in range
                        </span>
                    )}
                </div>
                <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} unit="%" />
                            <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                            <Tooltip
                                formatter={(value) => [value, '']}
                                contentStyle={{ borderRadius: '8px' }}
                                labelFormatter={(label, payload) => {
                                    const p = payload[0]?.payload;
                                    return p ? `${label}: ${p.pct ?? 0}% in range (${p.inRange}/${p.total})` : label;
                                }}
                            />
                            <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={32}>
                                {chartData.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={
                                            (entry.pct ?? 0) >= TIR_GOAL
                                                ? '#22c55e'
                                                : (entry.pct ?? 0) >= 50
                                                ? '#3b82f6'
                                                : '#f59e0b'
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex gap-4 justify-center text-xs text-gray-500">
                    <span>In range: {tir.today.inRange}/{tir.today.total} today</span>
                    <span>Below: {tir.today.below}</span>
                    <span>Above: {tir.today.above}</span>
                </div>
            </CardContent>
        </Card>
    );
}
