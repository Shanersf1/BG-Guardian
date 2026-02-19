import React, { useState, useEffect } from 'react';
import { api } from '@/api/localApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ExternalLink, Activity, Smartphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import CareLinkSetup from './CareLinkSetup';

export default function Connect() {
    const queryClient = useQueryClient();
    const [selectedSource, setSelectedSource] = useState(null);

    const { data: configStatus } = useQuery({
        queryKey: ['config'],
        queryFn: () => api.getConfig(),
    });

    useEffect(() => {
        const source = configStatus?.cgm_source || 'medtronic';
        setSelectedSource(source);
    }, [configStatus]);

    const saveSourceMutation = useMutation({
        mutationFn: (source) => api.saveConfig({ cgm_source: source }),
        onSuccess: (_, source) => {
            setSelectedSource(source);
            queryClient.invalidateQueries({ queryKey: ['config'] });
        },
    });

    const handleSelectSource = (source) => {
        if (source !== selectedSource) {
            saveSourceMutation.mutate(source);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 md:p-6">
            <div className="max-w-2xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold text-gray-800">Connect your CGM</h1>

                {/* CGM Source Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle>Choose your CGM system</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                            Select the glucose monitoring system you use to fetch readings.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => handleSelectSource('medtronic')}
                                className={`p-6 rounded-xl border-2 text-left transition-all ${
                                    selectedSource === 'medtronic'
                                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <Activity className={`w-10 h-10 mb-3 ${
                                    selectedSource === 'medtronic' ? 'text-blue-600' : 'text-gray-500'
                                }`} />
                                <h3 className="font-semibold text-lg text-gray-800">Medtronic CareLink</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    MiniMed pumps & sensors via CareLink Connect
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelectSource('dexcom')}
                                className={`p-6 rounded-xl border-2 text-left transition-all ${
                                    selectedSource === 'dexcom'
                                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <Smartphone className={`w-10 h-10 mb-3 ${
                                    selectedSource === 'dexcom' ? 'text-blue-600' : 'text-gray-500'
                                }`} />
                                <h3 className="font-semibold text-lg text-gray-800">Dexcom Share</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    G7/G6/G5/G4 via Dexcom Share
                                </p>
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {selectedSource === 'medtronic' && <CareLinkSetup embedded />}
                {selectedSource === 'dexcom' && <DexcomSetup />}
            </div>
        </div>
    );
}

function DexcomSetup() {
    const queryClient = useQueryClient();
    const [dexcomData, setDexcomData] = useState({
        dexcom_username: '',
        dexcom_password: '',
        dexcom_ous: true,
    });
    const [status, setStatus] = useState(null);

    const { data: configStatus } = useQuery({
        queryKey: ['config'],
        queryFn: () => api.getConfig(),
    });

    useEffect(() => {
        if (configStatus) {
            setDexcomData(prev => ({
                ...prev,
                dexcom_username: configStatus.dexcom_username || '',
                dexcom_password: configStatus.dexcom_password || '',
                dexcom_ous: configStatus.dexcom_ous !== false,
            }));
        }
    }, [configStatus]);

    const saveMutation = useMutation({
        mutationFn: (data) => api.saveConfig(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['config'] });
            setStatus({ type: 'success', message: 'Saved! You can now test the connection.' });
        },
        onError: (error) => {
            setStatus({ type: 'error', message: `Failed to save: ${error.message}` });
        },
    });

    const testMutation = useMutation({
        mutationFn: () => api.fetchCareLink(),
        onSuccess: (data) => {
            if (data.success) {
                const mmol = (data.glucose / 18.0182).toFixed(1);
                setStatus({ type: 'success', message: `Connected! Latest BG: ${mmol} mmol/L` });
                queryClient.invalidateQueries({ queryKey: ['bgReadings'] });
            } else {
                setStatus({ type: 'error', message: data.error || 'Connection failed' });
            }
        },
        onError: (error) => {
            setStatus({ type: 'error', message: `Error: ${error.message}` });
        },
    });

    const handleSave = () => {
        saveMutation.mutate({
            cgm_source: 'dexcom',
            dexcom_username: dexcomData.dexcom_username.trim(),
            dexcom_password: dexcomData.dexcom_password,
            dexcom_ous: dexcomData.dexcom_ous,
        });
    };

    const handleTest = () => {
        setStatus(null);
        testMutation.mutate();
    };

    const canSave = dexcomData.dexcom_username.trim() && dexcomData.dexcom_password;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Dexcom Share Setup</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                    Use your Dexcom Share credentials (username/email/phone). Enable Share in the Dexcom app and add at least one follower.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="dexcom_username">Dexcom Username (or email / phone with +country code)</Label>
                    <Input
                        id="dexcom_username"
                        placeholder="username or user@email.com"
                        value={dexcomData.dexcom_username}
                        onChange={(e) => setDexcomData({ ...dexcomData, dexcom_username: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dexcom_password">Dexcom Password</Label>
                    <Input
                        id="dexcom_password"
                        type="password"
                        placeholder="Your Dexcom password"
                        value={dexcomData.dexcom_password}
                        onChange={(e) => setDexcomData({ ...dexcomData, dexcom_password: e.target.value })}
                    />
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label htmlFor="dexcom_ous" className="font-medium">Outside United States</Label>
                        <p className="text-xs text-gray-500 mt-0.5">Enable if you use Dexcom outside the US (OUS region)</p>
                    </div>
                    <Switch
                        id="dexcom_ous"
                        checked={dexcomData.dexcom_ous}
                        onCheckedChange={(checked) => setDexcomData({ ...dexcomData, dexcom_ous: checked })}
                    />
                </div>
                <p className="text-xs text-gray-500">
                    Uses Dexcom Share API (pure Node.js; no Python required).
                </p>
                <div className="flex gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={saveMutation.isPending || !canSave}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                        {saveMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                        onClick={handleTest}
                        disabled={testMutation.isPending || !configStatus?.dexcomConfigured}
                        variant="outline"
                    >
                        {testMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</>
                        ) : (
                            <><RefreshCw className="w-4 h-4 mr-2" />Test Connection</>
                        )}
                    </Button>
                </div>
                {status && (
                    <div className={`flex items-center gap-2 p-4 rounded-lg ${
                        status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                        {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <p className="font-medium">{status.message}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
