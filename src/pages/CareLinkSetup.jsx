import React, { useState, useEffect } from 'react';
import { api } from '@/api/localApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function CareLinkSetup({ embedded = false }) {
    const queryClient = useQueryClient();
    const [mode, setMode] = useState('cookie'); // 'cookie' | 'oauth' | 'nightscout'
    const [nightscoutData, setNightscoutData] = useState({
        carelink_username: '',
        carelink_password: '',
        carelink_patient_id: '',
        country: 'gb'
    });
    const [tokenData, setTokenData] = useState({
        access_token: '',
        refresh_token: '',
        mag_identifier: '',
        client_id: '',
        client_secret: '',
        token_url: '',
        country: 'gb'
    });
    const [cookieEnabled, setCookieEnabled] = useState(false);
    const [cookiePath, setCookiePath] = useState('scripts/carelink-cookies.json');
    const [nightscoutConnectMode, setNightscoutConnectMode] = useState(false);
    const [status, setStatus] = useState(null);

    const { data: configStatus } = useQuery({
        queryKey: ['config'],
        queryFn: () => api.getConfig(),
    });

    useEffect(() => {
        if (configStatus?.carelink_cookie_enabled !== undefined) {
            setCookieEnabled(configStatus.carelink_cookie_enabled);
        }
        if (configStatus?.carelink_cookie_file) {
            setCookiePath(configStatus.carelink_cookie_file);
        }
        if (configStatus?.carelink_nightscout_connect_mode !== undefined) {
            setNightscoutConnectMode(configStatus.carelink_nightscout_connect_mode);
        }
        if (configStatus?.access_token || configStatus?.refresh_token) {
            setTokenData(prev => ({
                ...prev,
                access_token: configStatus.access_token || '',
                refresh_token: configStatus.refresh_token || '',
                mag_identifier: configStatus.mag_identifier || '',
                client_id: configStatus.client_id || '',
                client_secret: configStatus.client_secret || '',
                token_url: configStatus.token_url || '',
                country: configStatus.country || 'gb'
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
        }
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
        }
    });

    const handleSave = () => {
        let data;
        if (mode === 'cookie') {
            data = {
                cgm_source: 'medtronic',
                carelink_cookie_enabled: cookieEnabled,
                carelink_cookie_file: cookiePath?.trim() || 'scripts/carelink-cookies.json',
            };
        } else if (mode === 'nightscout') {
            data = { ...nightscoutData, country: nightscoutData.country || 'gb', carelink_nightscout_connect_mode: nightscoutConnectMode, cgm_source: 'medtronic' };
        } else {
            data = { ...tokenData, cgm_source: 'medtronic' };
        }
        saveMutation.mutate(data);
    };

    const handleTest = () => {
        setStatus(null);
        testMutation.mutate();
    };

    const canSaveNightscout = nightscoutData.carelink_username && nightscoutData.carelink_password;
    const canSaveOAuth = tokenData.access_token && tokenData.refresh_token;

    const content = (
        <>
                {!embedded && <h1 className="text-3xl font-bold text-gray-800">CareLink Setup</h1>}
                {embedded && <h2 className="text-xl font-semibold text-gray-800">Medtronic CareLink Setup</h2>}
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={mode === 'cookie' ? 'default' : 'outline'}
                        onClick={() => setMode('cookie')}
                    >
                        Cookie File (EU recommended)
                    </Button>
                    <Button
                        variant={mode === 'oauth' ? 'default' : 'outline'}
                        onClick={() => setMode('oauth')}
                    >
                        OAuth Tokens
                    </Button>
                    <Button
                        variant={mode === 'nightscout' ? 'default' : 'outline'}
                        onClick={() => setMode('nightscout')}
                    >
                        Username/Password
                    </Button>
                </div>

                {mode === 'cookie' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Cookie Export (works with EU CareLink)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Log in to CareLink in a normal browser, export cookies with the Cookie-Editor extension, 
                            then the app fetches BG automatically every 5 minutes.
                        </p>
                        <ol className="list-decimal ml-4 space-y-1 text-sm">
                            <li>Open Edge, go to carelink.minimed.eu, log in (solve CAPTCHA)</li>
                            <li>Install Cookie-Editor from Chrome Web Store</li>
                            <li>Cookie-Editor → Export → JSON, save as <code className="bg-gray-100 px-1">scripts/carelink-cookies.json</code></li>
                            <li>Enable below and click Save</li>
                        </ol>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <Label htmlFor="cookie-enabled" className="flex-1">Use cookie file for CareLink fetch</Label>
                            <Switch
                                id="cookie-enabled"
                                checked={cookieEnabled}
                                onCheckedChange={setCookieEnabled}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cookie-path">Cookie file path (relative to project)</Label>
                            <Input
                                id="cookie-path"
                                placeholder="scripts/carelink-cookies.json"
                                value={cookiePath}
                                onChange={(e) => setCookiePath(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleSave}
                                disabled={saveMutation.isPending}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {saveMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                                onClick={handleTest}
                                disabled={testMutation.isPending || !cookieEnabled}
                                variant="outline"
                            >
                                {testMutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</>
                                ) : (
                                    <><RefreshCw className="w-4 h-4 mr-2" />Test Connection</>
                                )}
                            </Button>
                        </div>
                        {!cookieEnabled && (
                            <p className="text-sm text-amber-600">Enable the switch and click Save, then Test.</p>
                        )}
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
                )}

                {mode === 'nightscout' && (
                <Card>
                    <CardHeader>
                        <CardTitle>CareLink Username & Password</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                            <p className="font-semibold text-blue-800">Nightscout-connect method</p>
                            <p className="text-blue-700 mt-1">
                                Uses Node.js axios + cookies to carelink.minimed.eu (same as <a href="https://github.com/nightscout/nightscout-connect" target="_blank" rel="noopener noreferrer" className="underline">nightscout-connect</a>). No Python, no OAuth—avoids TLS fingerprint issues.
                            </p>
                        </div>
                        <p className="text-sm text-gray-600">
                            EU may require reCAPTCHA; if login fails, use Cookie Export instead.
                        </p>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <Label htmlFor="ns-connect-mode" className="font-medium">Use nightscout-connect method</Label>
                                <p className="text-xs text-gray-500 mt-0.5">Node.js login to CareLink (overrides cookie mode when on)</p>
                            </div>
                            <Switch
                                id="ns-connect-mode"
                                checked={nightscoutConnectMode}
                                onCheckedChange={setNightscoutConnectMode}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ns_username">CareLink Username</Label>
                            <Input
                                id="ns_username"
                                placeholder="Your CareLink username"
                                value={nightscoutData.carelink_username}
                                onChange={(e) => setNightscoutData({ ...nightscoutData, carelink_username: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ns_password">CareLink Password</Label>
                            <Input
                                id="ns_password"
                                type="password"
                                placeholder="Your CareLink password"
                                value={nightscoutData.carelink_password}
                                onChange={(e) => setNightscoutData({ ...nightscoutData, carelink_password: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ns_patient_id">Patient ID (optional – Care Partner only)</Label>
                            <Input
                                id="ns_patient_id"
                                placeholder="Leave empty for patient account or single patient"
                                value={nightscoutData.carelink_patient_id}
                                onChange={(e) => setNightscoutData({ ...nightscoutData, carelink_patient_id: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ns_country">Country Code</Label>
                            <Input
                                id="ns_country"
                                placeholder="gb"
                                value={nightscoutData.country}
                                onChange={(e) => setNightscoutData({ ...nightscoutData, country: e.target.value || 'gb' })}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleSave}
                                disabled={saveMutation.isPending || !canSaveNightscout}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {saveMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                                onClick={handleTest}
                                disabled={testMutation.isPending || !configStatus?.configured}
                                variant="outline"
                            >
                                {testMutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</>
                                ) : (
                                    <><RefreshCw className="w-4 h-4 mr-2" />Test Connection</>
                                )}
                            </Button>
                        </div>
                        {!configStatus?.configured && (
                            <p className="text-sm text-amber-600">Save username/password first to enable Test Connection.</p>
                        )}
                        {status && (
                            <div className={`flex items-center gap-2 p-4 rounded-lg ${
                                status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                                {status.type === 'success' ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5" />
                                )}
                                <p className="font-medium">{status.message}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                )}

                {mode === 'oauth' && (
                <Card>
                    <CardHeader>
                        <CardTitle>CareLink OAuth Tokens</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-lg text-sm space-y-2">
                            <p className="font-semibold">From carelink-bridge (recommended for EU):</p>
                            <ol className="list-decimal ml-4 space-y-1">
                                <li>Run <code>npm run login</code> in carelink-bridge (opens browser for CAPTCHA)</li>
                                <li>Copy from <code>logindata.json</code>: access_token, refresh_token, client_id, token_url</li>
                                <li>Paste below. Leave mag_identifier and client_secret blank.</li>
                            </ol>
                            <p className="font-semibold pt-2">Or use carelink-python-client:</p>
                            <ol className="list-decimal ml-4 space-y-1">
                                <li>Run in WSL: <code>python3 carelink_carepartner_api_login.py</code></li>
                                <li>Copy all fields from logindata.json including mag_identifier, client_secret</li>
                            </ol>
                            <a 
                                href="https://github.com/domien-f/carelink-bridge" 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline mt-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                carelink-bridge on GitHub
                            </a>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="access_token">Access Token</Label>
                            <Textarea
                                id="access_token"
                                placeholder="Paste your access_token here"
                                value={tokenData.access_token}
                                onChange={(e) => setTokenData({ ...tokenData, access_token: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="refresh_token">Refresh Token</Label>
                            <Textarea
                                id="refresh_token"
                                placeholder="Paste your refresh_token here"
                                value={tokenData.refresh_token}
                                onChange={(e) => setTokenData({ ...tokenData, refresh_token: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="mag_identifier">MAG Identifier (optional – carelink-bridge skips this)</Label>
                            <Input
                                id="mag_identifier"
                                placeholder="mag-identifier value"
                                value={tokenData.mag_identifier}
                                onChange={(e) => setTokenData({ ...tokenData, mag_identifier: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="client_id">Client ID (required for token refresh)</Label>
                            <Input
                                id="client_id"
                                placeholder="client_id value"
                                value={tokenData.client_id}
                                onChange={(e) => setTokenData({ ...tokenData, client_id: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="client_secret">Client Secret (optional – carelink-bridge skips this)</Label>
                            <Input
                                id="client_secret"
                                type="password"
                                placeholder="client_secret value"
                                value={tokenData.client_secret}
                                onChange={(e) => setTokenData({ ...tokenData, client_secret: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="token_url">Token URL (required for carelink-bridge refresh)</Label>
                            <Input
                                id="token_url"
                                placeholder="https://carelink-login.minimed.eu/oauth/token"
                                value={tokenData.token_url}
                                onChange={(e) => setTokenData({ ...tokenData, token_url: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="country">Country Code</Label>
                            <Input
                                id="country"
                                placeholder="gb (or us)"
                                value={tokenData.country}
                                onChange={(e) => setTokenData({ ...tokenData, country: e.target.value || 'gb' })}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleSave}
                                disabled={saveMutation.isPending || !tokenData.access_token?.trim() || !tokenData.refresh_token?.trim()}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {saveMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Tokens'
                                )}
                            </Button>
                            <Button
                                onClick={handleTest}
                                disabled={testMutation.isPending || !configStatus?.configured}
                                variant="outline"
                                className="flex-1"
                            >
                                {testMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Testing...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Test Connection
                                    </>
                                )}
                            </Button>
                        </div>

                        {!configStatus?.configured && (
                            <p className="text-sm text-amber-600">Save tokens first to enable Test Connection.</p>
                        )}

                        {status && (
                            <div className={`flex items-center gap-2 p-4 rounded-lg ${
                                status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                                {status.type === 'success' ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5" />
                                )}
                                <p className="font-medium">{status.message}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                )}
        </>
    );

    if (embedded) {
        return <div className="space-y-6">{content}</div>;
    }
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 md:p-6">
            <div className="max-w-2xl mx-auto space-y-6">{content}</div>
        </div>
    );
}
