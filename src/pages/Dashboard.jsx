import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { api } from '@/api/localApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    if (!settings) return 'bg-gray-50 dark:bg-slate-800';
    const displayValue = (settings?.bg_unit ?? 'mmol') === 'mmol' ? toMmol(mgdlValue) : mgdlValue;
    const low = settings.low_threshold ?? ((settings?.bg_unit ?? 'mmol') === 'mmol' ? 3.9 : 70);
    const high = settings.high_threshold ?? ((settings?.bg_unit ?? 'mmol') === 'mmol' ? 10 : 180);
    if (displayValue < low) return 'bg-red-50 dark:bg-red-900/20';
    if (displayValue > high) return 'bg-orange-50 dark:bg-orange-900/20';
    return 'bg-green-50 dark:bg-green-900/20';
};

const formatBG = (mgdlValue, settings) => {
    if (mgdlValue == null) return '—';
    return (settings?.bg_unit ?? 'mmol') === 'mmol' ? toMmol(mgdlValue) : mgdlValue;
};

const getUnit = (settings) => (settings?.bg_unit ?? 'mmol') === 'mmol' ? 'mmol/L' : 'mg/dL';

export default function Dashboard() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        const onBggDataUpdate = (event) => {
            try {
                const payload = event?.detail;
                if (payload == null) return;
                const newData = typeof payload === 'string' ? JSON.parse(payload) : payload;
                if (Array.isArray(newData)) {
                    queryClient.setQueryData(['bgReadings'], newData);
                    console.log('bgg-data-update: received', newData.length, 'readings from native background service');
                } else {
                    queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
                }
            } catch (err) {
                console.warn('bgg-data-update: failed to parse, refetching instead', err);
                queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
            }
        };
        window.addEventListener('bgg-data-update', onBggDataUpdate);
        return () => window.removeEventListener('bgg-data-update', onBggDataUpdate);
    }, [queryClient]);

    const { data: readings = [], isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
        queryKey: ['bgReadings'],
        queryFn: () => api.getReadings(50),
        refetchInterval: false,
    });

    const isRefreshingData = isRefreshing || (isFetching && readings.length > 0);

    // On native: refetch when Dashboard mounts (catches cold start - app opened from closed)
    useEffect(() => {
        if (Capacitor.getPlatform() !== 'web') {
            refetch();
        }
    }, [refetch]);

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
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                    <Activity className="w-12 h-12 text-blue-500 dark:text-blue-400 animate-pulse mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-slate-400">Loading BG data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6 transition-colors duration-200">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100">BG Monitor</h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-600 dark:text-slate-400">
                            {userName && (
                                <span>Welcome, {userName}</span>
                            )}
                            <span className={isConnected ? 'text-green-600 font-medium' : 'text-amber-600'}>
                                {isConnected ? `Connected to ${cgmLabel}` : `${cgmLabel} (not connected)`}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                        {import.meta.env.DEV && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['bgReadings'] })}
                                disabled={isRefreshingData}
                                className="text-xs"
                                title="Simulate app resume refresh"
                            >
                                Test refresh
                            </Button>
                        )}
                        <Button 
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingData ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {refreshError && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200">
                        <p className="font-medium">Refresh failed</p>
                        <p className="text-sm mt-1">{refreshError}</p>
                    </div>
                )}

                {latestReading ? (
                    <Card className={`${getBGBackground(latestReading.glucose_value, alertSettings)} border-2 dark:border-slate-700 transition-all duration-200`}>
                        <CardContent className="p-10">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <div className="flex items-center gap-6">
                                    <div className={`text-7xl md:text-9xl font-bold ${getBGColor(latestReading.glucose_value, alertSettings)}`}>
                                        {formatBG(latestReading.glucose_value, alertSettings)}
                                    </div>
                                    {getTrendIcon(latestReading.trend)}
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-2xl text-gray-600 dark:text-slate-400">{getUnit(alertSettings)}</p>
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
                        <CardContent className="p-10 text-center">
                            <p className="text-gray-500 dark:text-slate-400">No BG readings yet. Set up CareLink or add manually.</p>
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
                                    <div key={reading.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg transition-colors duration-200">
                                    <div className="flex items-center gap-3">
                                        {getTrendIcon(reading.trend)}
                                        <span className={`text-2xl font-bold ${getBGColor(reading.glucose_value, alertSettings)}`}>
                                            {formatBG(reading.glucose_value, alertSettings)}
                                        </span>
                                    </div>
                                    <span className="text-gray-500 dark:text-slate-400">
                                        {format(new Date(reading.timestamp), 'HH:mm dd/MM')}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {dataUpdatedAt > 0 && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                                Updated {getTimeSince(dataUpdatedAt)}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
