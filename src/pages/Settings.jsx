import React, { useState, useEffect } from 'react';
import { api } from '@/api/localApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Volume2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { playAlert } from '@/utils/alertAudio';
import MobileNotificationCard from '@/components/MobileNotificationCard';
import { toast } from '@/components/ui/use-toast';

export default function Settings() {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        bg_unit: 'mmol',
        high_threshold: 10,
        low_threshold: 3.9,
        rapid_rise_threshold: 1.7,
        rapid_fall_threshold: 1.7,
        high_alert_enabled: true,
        low_alert_enabled: true,
        rapid_rise_enabled: true,
        rapid_fall_enabled: true,
        stale_data_enabled: true,
        alert_email: '',
        user_name: '',
        audio_alerts_enabled: false,
        alert_volume: 1
    });

    const { data: settings } = useQuery({
        queryKey: ['alertSettings'],
        queryFn: () => api.getSettings(),
    });

    useEffect(() => {
        if (settings) {
            setFormData(prev => ({ ...prev, ...settings }));
        }
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: (data) => api.saveSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alertSettings'] });
            toast({ title: 'Settings saved', description: 'Your alert settings have been saved successfully.' });
        },
        onError: (err) => {
            toast({ title: 'Save failed', description: err?.message || 'Could not save settings. Try again.', variant: 'destructive' });
        }
    });

    const handleSave = () => {
        saveMutation.mutate(formData);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 md:p-6 overflow-x-hidden">
            <div className="max-w-4xl mx-auto space-y-6 min-w-0">
                <h1 className="text-3xl font-bold text-gray-800">Alert Settings</h1>

                <Card>
                    <CardHeader>
                        <CardTitle>BG Thresholds ({formData.bg_unit === 'mmol' ? 'mmol/L' : 'mg/dL'})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="bg_unit">BG Unit</Label>
                            <Select
                                value={formData.bg_unit || 'mmol'}
                                onValueChange={(v) => setFormData({ ...formData, bg_unit: v })}
                            >
                                <SelectTrigger id="bg_unit">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="mmol">mmol/L</SelectItem>
                                    <SelectItem value="mgdl">mg/dL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="high_threshold">High Threshold</Label>
                                <Input
                                    id="high_threshold"
                                    type="number"
                                    value={Number.isFinite(formData.high_threshold) ? formData.high_threshold : ''}
                                    onChange={(e) => setFormData({ ...formData, high_threshold: e.target.value === '' ? 10 : parseFloat(e.target.value) || 10 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="low_threshold">Low Threshold</Label>
                                <Input
                                    id="low_threshold"
                                    type="number"
                                    value={Number.isFinite(formData.low_threshold) ? formData.low_threshold : ''}
                                    onChange={(e) => setFormData({ ...formData, low_threshold: e.target.value === '' ? 3.9 : parseFloat(e.target.value) || 3.9 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="rapid_rise_threshold">Rapid Rise (in 15 min)</Label>
                                <Input
                                    id="rapid_rise_threshold"
                                    type="number"
                                    value={Number.isFinite(formData.rapid_rise_threshold) ? formData.rapid_rise_threshold : ''}
                                    onChange={(e) => setFormData({ ...formData, rapid_rise_threshold: e.target.value === '' ? 1.7 : parseFloat(e.target.value) || 1.7 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="rapid_fall_threshold">Rapid Fall (in 15 min)</Label>
                                <Input
                                    id="rapid_fall_threshold"
                                    type="number"
                                    value={Number.isFinite(formData.rapid_fall_threshold) ? formData.rapid_fall_threshold : ''}
                                    onChange={(e) => setFormData({ ...formData, rapid_fall_threshold: e.target.value === '' ? 1.7 : parseFloat(e.target.value) || 1.7 })}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Alert Types</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { id: 'high_alert', key: 'high_alert_enabled', label: 'High BG Alert', desc: 'Alert when BG exceeds high threshold' },
                            { id: 'low_alert', key: 'low_alert_enabled', label: 'Low BG Alert', desc: 'Alert when BG drops below low threshold' },
                            { id: 'rapid_rise', key: 'rapid_rise_enabled', label: 'Rapid Rise Alert', desc: 'Alert when BG rises quickly' },
                            { id: 'rapid_fall', key: 'rapid_fall_enabled', label: 'Rapid Fall Alert', desc: 'Alert when BG drops quickly' },
                            { id: 'stale_data', key: 'stale_data_enabled', label: 'Stale Data Alert', desc: 'Alert when no reading for 20+ minutes' }
                        ].map(({ id, key, label, desc }) => (
                            <div key={id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg min-w-0">
                                <div className="min-w-0 flex-1">
                                    <Label htmlFor={id} className="font-medium">{label}</Label>
                                    <p className="text-sm text-gray-500 break-words">{desc}</p>
                                </div>
                                <Switch
                                    id={id}
                                    checked={formData[key]}
                                    onCheckedChange={(checked) => setFormData({ ...formData, [key]: checked })}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Voice Alerts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 overflow-hidden min-w-0">
                        <p className="text-sm text-gray-600 break-words">
                            Plays beeps and voice warnings in your browser when alerts fire. Works on PC and mobile.
                        </p>
                        <div className="space-y-2 min-w-0">
                            <Label htmlFor="alert_volume">Alert volume</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    id="alert_volume"
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={[typeof formData.alert_volume === 'number' ? formData.alert_volume : 1]}
                                    onValueChange={([v]) => setFormData({ ...formData, alert_volume: v ?? 1 })}
                                    className="flex-1"
                                />
                                <span className="text-sm text-gray-600 w-12">
                                    {Math.round((formData.alert_volume ?? 1) * 100)}%
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2 min-w-0">
                            <Label htmlFor="user_name">Your name (for voice greeting)</Label>
                            <Input
                                id="user_name"
                                placeholder="e.g. John"
                                value={formData.user_name}
                                onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                                className="min-w-0"
                            />
                        </div>
                        <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg min-w-0">
                            <div className="min-w-0 flex-1">
                                <Label htmlFor="audio_alerts" className="font-medium">Enable audio alerts</Label>
                                <p className="text-sm text-gray-500 mt-0.5 break-words">Beeps + spoken warning on this device</p>
                            </div>
                            <Switch
                                id="audio_alerts"
                                checked={formData.audio_alerts_enabled}
                                onCheckedChange={(checked) => setFormData({ ...formData, audio_alerts_enabled: checked })}
                            />
                        </div>
                        <div className="space-y-2 min-w-0">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start text-left whitespace-normal h-auto py-3 px-4"
                                onClick={() => {
                                const vol = formData.alert_volume ?? 1;
                                if (vol <= 0) {
                                    toast({ title: 'Volume is 0%', description: 'Move the volume slider up to hear the test.', variant: 'destructive' });
                                    return;
                                }
                                playAlert('low', formData.user_name || 'User', 3.5, vol);
                            }}
                            >
                                <Volume2 className="w-4 h-4 mr-2 shrink-0" />
                                <span className="break-words">Test alert (tap to unlock audio on mobile)</span>
                            </Button>
                            <p className="text-xs text-gray-500 break-words">
                                On mobile, tap Test alert once to allow audio. Keep the app open in the foreground for alerts.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <MobileNotificationCard />

                <Card>
                    <CardHeader>
                        <CardTitle>Alert Email</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="alert_email">Email Address</Label>
                            <Input
                                id="alert_email"
                                type="email"
                                placeholder="your@email.com"
                                value={formData.alert_email}
                                onChange={(e) => setFormData({ ...formData, alert_email: e.target.value })}
                            />
                            <p className="text-sm text-gray-500">Email alerts require additional setup (e.g. nodemailer). For now, thresholds are used for display only.</p>
                        </div>
                    </CardContent>
                </Card>

                <Button 
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                >
                    <Save className="w-4 h-4 mr-2" />
                    {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}
