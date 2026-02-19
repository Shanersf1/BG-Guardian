import React from 'react';
import { api } from '@/api/localApi';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown } from 'lucide-react';
import { createPageUrl } from '../utils';
import { toMmol } from '@/utils/bgUnits';

const getTrendIcon = (trend, size = 'w-12 h-12') => {
    const c = size;
    switch (trend) {
        case 'UP_DOUBLE': return <ArrowUp className={`${c} text-red-500`} strokeWidth={3} />;
        case 'UP': return <TrendingUp className={`${c} text-orange-500`} />;
        case 'FLAT': return <Minus className={`${c} text-gray-500`} />;
        case 'DOWN': return <TrendingDown className={`${c} text-orange-500`} />;
        case 'DOWN_DOUBLE': return <ArrowDown className={`${c} text-red-500`} strokeWidth={3} />;
        default: return <Minus className={`${c} text-gray-400`} />;
    }
};

const getBGColor = (mgdlValue, settings) => {
    if (!settings) return 'text-gray-800';
    const displayValue = (settings?.bg_unit ?? 'mmol') === 'mmol' ? toMmol(mgdlValue) : mgdlValue;
    const low = settings.low_threshold ?? ((settings?.bg_unit ?? 'mmol') === 'mmol' ? 3.9 : 70);
    const high = settings.high_threshold ?? ((settings?.bg_unit ?? 'mmol') === 'mmol' ? 10 : 180);
    if (displayValue < low) return 'text-red-600';
    if (displayValue > high) return 'text-orange-600';
    return 'text-green-600';
};

const getBGBackground = (mgdlValue, settings) => {
    if (!settings) return 'bg-gray-50';
    const displayValue = (settings?.bg_unit ?? 'mmol') === 'mmol' ? toMmol(mgdlValue) : mgdlValue;
    const low = settings.low_threshold ?? ((settings?.bg_unit ?? 'mmol') === 'mmol' ? 3.9 : 70);
    const high = settings.high_threshold ?? ((settings?.bg_unit ?? 'mmol') === 'mmol' ? 10 : 180);
    if (displayValue < low) return 'bg-red-50';
    if (displayValue > high) return 'bg-orange-50';
    return 'bg-green-50';
};

const formatBG = (mgdlValue, settings) => {
    if (mgdlValue == null) return '—';
    return (settings?.bg_unit ?? 'mmol') === 'mmol' ? toMmol(mgdlValue) : mgdlValue;
};

const getUnit = (settings) => (settings?.bg_unit ?? 'mmol') === 'mmol' ? 'mmol/L' : 'mg/dL';

const getTimeSince = (timestamp) => {
    const minutes = Math.floor((new Date() - new Date(timestamp)) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hr ago' : `${hours} hrs ago`;
};

export default function Widget() {
    const { data: readings = [], isLoading } = useQuery({
        queryKey: ['bgReadings'],
        queryFn: () => api.getReadings(10),
        refetchInterval: 60000,
    });
    const { data: settings } = useQuery({ queryKey: ['alertSettings'], queryFn: () => api.getSettings() });
    const latestReading = readings[0];

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
                <Activity className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                {latestReading ? (
                    <div className={`w-full max-w-sm rounded-2xl p-8 ${getBGBackground(latestReading.glucose_value, settings)} border-2 border-gray-200/50 shadow-lg`}>
                        <div className="flex items-center justify-center gap-4">
                            <div className={`text-7xl sm:text-8xl font-bold ${getBGColor(latestReading.glucose_value, settings)}`}>
                                {formatBG(latestReading.glucose_value, settings)}
                            </div>
                            {getTrendIcon(latestReading.trend)}
                        </div>
                        <p className="text-center text-lg text-gray-600 mt-3">{getUnit(settings)}</p>
                        <p className="text-center text-gray-500 mt-1 flex items-center justify-center gap-1">
                            <span>Updated {getTimeSince(latestReading.timestamp)}</span>
                        </p>
                    </div>
                ) : (
                    <div className="text-center p-8">
                        <p className="text-gray-500 text-lg">No readings yet</p>
                        <p className="text-gray-400 text-sm mt-2">Connect your CGM or add a reading</p>
                    </div>
                )}
            </div>
            <div className="p-4 border-t border-gray-200/50">
                <Link
                    to={createPageUrl('Dashboard')}
                    className="block w-full text-center py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                >
                    Open full app
                </Link>
            </div>
        </div>
    );
}
