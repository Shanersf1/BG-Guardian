import React, { useState, useEffect } from 'react';
import { api } from '@/api/localApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Smartphone } from 'lucide-react';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

export default function MobileNotificationCard() {
    const [permState, setPermState] = useState(null);
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushError, setPushError] = useState(null);

    useEffect(() => {
        if ('Notification' in window) {
            setPermState(Notification.permission);
        }
        async function checkSubscription() {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
            try {
                const reg = await navigator.serviceWorker.getRegistration('/');
                if (reg?.pushManager) {
                    const sub = await reg.pushManager.getSubscription();
                    if (sub) setPushSubscribed(true);
                }
            } catch (_) {}
        }
        checkSubscription();
    }, []);

    const subscribeToPush = async () => {
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPushError('Push not supported in this browser');
            return;
        }
        try {
            const p = await Notification.requestPermission();
            setPermState(p);
            setPushError(null);
            if (p !== 'granted') return;

            const { publicKey } = await api.getPushPublicKey();

            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await reg.update();
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey),
                });
            }
            await api.subscribePush(sub.toJSON());
            setPushSubscribed(true);
        } catch (e) {
            const msg = e.message || 'Subscription failed';
            setPushError(
                msg.includes('404') || msg.includes('Failed to fetch')
                    ? `${msg} — ensure backend is running (npm run dev or npm run server) and restart after code changes`
                    : msg
            );
        }
    };

    const unsubscribeFromPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        setPushError(null);
        try {
            const reg = await navigator.serviceWorker.getRegistration('/');
            const sub = reg?.pushManager ? await reg.pushManager.getSubscription() : null;
            if (sub) {
                await sub.unsubscribe();
                await api.unsubscribePush(sub.endpoint);
            }
            setPushSubscribed(false);
        } catch (e) {
            setPushError(e.message || 'Failed to disable push');
        }
    };

    const handleToggle = async (checked) => {
        if (checked) {
            await subscribeToPush();
        } else {
            await unsubscribeFromPush();
        }
    };

    if (!('Notification' in window)) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    Push notifications (screen-off alerts)
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                    Enable to receive alerts when your phone is locked. Works with audio alerts — enable both in Voice Alerts.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                <p className="font-medium mb-1">Now available</p>
                <p>When an alert fires (low/high BG, rapid change, stale data), you&apos;ll get a notification with sound — even when the screen is locked.</p>
            </div>
            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                    <Label htmlFor="push-toggle" className="font-medium cursor-pointer">
                        Push notifications
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {pushSubscribed && 'On — alerts reach this device when screen is off'}
                        {permState === 'granted' && !pushSubscribed && 'Off — tap toggle to enable'}
                        {permState === 'denied' && 'Denied — enable in browser/device settings'}
                        {permState === 'default' && 'Tap toggle to allow and subscribe'}
                    </p>
                </div>
                <Switch
                    id="push-toggle"
                    checked={!!pushSubscribed}
                    onCheckedChange={handleToggle}
                    disabled={permState === 'denied'}
                />
            </div>
            {pushError && <p className="text-sm text-red-600">{pushError}</p>}
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Requires audio alerts enabled in Voice Alerts section</li>
                <li>Add to home screen (browser menu) — required for push on iOS Safari</li>
                <li>HTTPS required in production (localhost works for testing)</li>
            </ul>
            </CardContent>
        </Card>
    );
}
