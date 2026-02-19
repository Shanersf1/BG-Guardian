import React, { useState } from 'react';
import { api } from '@/api/localApi';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, Activity, Droplet, Battery, Clock } from 'lucide-react';
import { format } from 'date-fns';
import BGChart from '../components/dashboard/BGChart';
import TimeInRangeCard from '../components/dashboard/TimeInRangeCard';
import { toMmol } from '@/utils/bgUnits';

const getTrendIcon = (trend) => {
    switch (trend) {
        case 'UP_DOUBLE': return <ArrowUp className="w-8 h-8 text-red-500" strokeWidth={3} />;
        case 'UP': return <TrendingUp className="w-8 h-8 text-orange-500" />;
        case 'FLAT': return <Minus className="w-8 h-8 text-gray-500" />;
        case 'DOWN': return <TrendingDown className="w-8 h-8 text-orange-500" />;
        case 'DOWN_DOUBLE': return <ArrowDown className="w-8 h-8 text-red-500" strokeWidth={3} />;
        default: return <Minus className="w-8 h-8 text-gray-400" />;
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

export default function Dashboard() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState(null);

    const { data: readings = [], isLoading, refetch } = useQuery({
        queryKey: ['bgReadings'],
        queryFn: () => api.getReadings(50),
        refetchInterval: 300000,
    });

    const { data: settings } = useQuery({
        queryKey: ['alertSettings'],
        queryFn: () => api.getSettings(),
    });

    const { data: config } = useQuery({
        queryKey: ['config'],
        queryFn: () => api.getConfig(),
    });

    const alertSettings = settings;
    const userName = settings?.user_name?.trim() || null;
    const cgmSource = config?.cgm_source || 'medtronic';
    const isConnected = config?.configured === true;
    const cgmLabel = cgmSource === 'dexcom' ? 'Dexcom Share' : 'Medtronic CareLink';
    const latestReading = readings[0];

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setRefreshError(null);
        try {
            await api.fetchCareLink();
            await refetch();
        } catch (error) {
            setRefreshError(error?.message || 'Refresh failed');
            console.error('Refresh failed:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const getTimeSince = (timestamp) => {
        const minutes = Math.floor((new Date() - new Date(timestamp)) / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes === 1) return '1 min ago';
        if (minutes < 60) return `${minutes} mins ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m ago`;
    };

    const isStale = latestReading && (new Date() - new Date(latestReading.timestamp)) > 20 * 60000;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <Activity className="w-12 h-12 text-blue-500 animate-pulse mx-auto mb-4" />
                    <p className="text-gray-500">Loading BG data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 md:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">BG Monitor</h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-600">
                            {userName && (
                                <span>Welcome, {userName}</span>
                            )}
                            <span className={isConnected ? 'text-green-600 font-medium' : 'text-amber-600'}>
                                {isConnected ? `Connected to ${cgmLabel}` : `${cgmLabel} (not connected)`}
                            </span>
                        </div>
                    </div>
                    <Button 
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="bg-blue-600 hover:bg-blue-700 self-start sm:self-center"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {refreshError && (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
                        <p className="font-medium">Refresh failed</p>
                        <p className="text-sm mt-1">{refreshError}</p>
                    </div>
                )}

                {latestReading ? (
                    <Card className={`${getBGBackground(latestReading.glucose_value, alertSettings)} border-2`}>
                        <CardContent className="p-8">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <div className="flex items-center gap-6">
                                    <div className={`text-7xl md:text-9xl font-bold ${getBGColor(latestReading.glucose_value, alertSettings)}`}>
                                        {formatBG(latestReading.glucose_value, alertSettings)}
                                    </div>
                                    {getTrendIcon(latestReading.trend)}
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-2xl text-gray-600">{getUnit(alertSettings)}</p>
                                    <p className={`text-lg font-medium ${isStale ? 'text-red-600' : 'text-gray-500'}`}>
                                        <Clock className="w-4 h-4 inline mr-1" />
                                        {getTimeSince(latestReading.timestamp)}
                                    </p>
                                    {isStale && (
                                        <p className="text-red-600 font-semibold">⚠️ Stale Data</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <p className="text-gray-500">No BG readings yet. Set up CareLink or add manually.</p>
                        </CardContent>
                    </Card>
                )}

                {latestReading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {latestReading.active_insulin !== undefined && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                                        <Droplet className="w-4 h-4" />
                                        Active Insulin
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold text-blue-600">{latestReading.active_insulin.toFixed(2)}U</p>
                                </CardContent>
                            </Card>
                        )}
                        {latestReading.pump_battery !== undefined && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                                        <Battery className="w-4 h-4" />
                                        Pump Battery
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold text-green-600">{latestReading.pump_battery}%</p>
                                </CardContent>
                            </Card>
                        )}
                        {latestReading.sensor_duration !== undefined && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Sensor Age
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold text-purple-600">{Math.floor(latestReading.sensor_duration)}h</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {readings.length > 0 && (
                    <>
                        <TimeInRangeCard />
                        <BGChart readings={readings} settings={alertSettings} />
                    </>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Readings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {readings.slice(0, 10).map((reading) => (
                                <div key={reading.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        {getTrendIcon(reading.trend)}
                                        <span className={`text-2xl font-bold ${getBGColor(reading.glucose_value, alertSettings)}`}>
                                            {formatBG(reading.glucose_value, alertSettings)}
                                        </span>
                                    </div>
                                    <span className="text-gray-500">
                                        {format(new Date(reading.timestamp), 'HH:mm dd/MM')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
