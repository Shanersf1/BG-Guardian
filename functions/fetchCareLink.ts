import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        // Check if we have OAuth tokens
        if (!user.carelink_access_token || !user.carelink_refresh_token) {
            return Response.json({ 
                error: 'OAuth tokens not configured',
                message: 'Please set up CareLink OAuth tokens in the CareLink Setup page'
            }, { status: 400 });
        }

        const CARELINK_CONFIG_URL = 'https://clcloud.minimed.eu/connect/carepartner/v11/discover/android/3.3';
        const country = 'gb';

        // Step 1: Get config for region
        const configResp = await fetch(CARELINK_CONFIG_URL, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 10; Nexus 5X Build/QQ3A.200805.001)'
            }
        });

        if (!configResp.ok) {
            return Response.json({ error: 'Failed to get CareLink config' }, { status: 500 });
        }

        const configData = await configResp.json();

        // Find region for country
        let region = null;
        for (const c of configData.supportedCountries) {
            if (c[country.toUpperCase()]) {
                region = c[country.toUpperCase()].region;
                break;
            }
        }

        if (!region) {
            return Response.json({ error: 'Country not supported' }, { status: 400 });
        }

        // Get config for region
        let config = null;
        for (const c of configData.CP) {
            if (c.region === region) {
                config = c;
                break;
            }
        }

        if (!config) {
            return Response.json({ error: 'Failed to get region config' }, { status: 500 });
        }

        // Check if token needs refresh
        const tokenExpires = user.carelink_token_expires ? new Date(user.carelink_token_expires) : new Date(0);
        const now = new Date();
        let accessToken = user.carelink_access_token;

        if (tokenExpires <= now) {
            // Refresh token
            const ssoResp = await fetch(config.SSOConfiguration);
            const ssoConfig = await ssoResp.json();
            
            const tokenUrl = `https://${ssoConfig.server.hostname}:${ssoConfig.server.port}/${ssoConfig.server.prefix}${ssoConfig.system_endpoints.token_endpoint_path}`;
            
            const refreshResp = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${btoa(user.carelink_client_id + ':' + user.carelink_client_secret)}`
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: user.carelink_refresh_token,
                    scope: ssoConfig.oauth.client.client_ids[0].scope
                })
            });

            if (!refreshResp.ok) {
                return Response.json({ 
                    error: 'Failed to refresh token',
                    message: 'Your OAuth tokens have expired. Please re-authenticate in CareLink Setup.'
                }, { status: 401 });
            }

            const refreshData = await refreshResp.json();
            accessToken = refreshData.access_token;

            // Update stored tokens
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1);

            await base44.asServiceRole.auth.updateMe({
                carelink_access_token: accessToken,
                carelink_refresh_token: refreshData.refresh_token || user.carelink_refresh_token,
                carelink_token_expires: expiresAt.toISOString()
            });
        }

        // Step 2: Get user info
        const userUrl = config.baseUrlCareLink + '/users/me';
        const userResp = await fetch(userUrl, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'mag-identifier': user.carelink_mag_identifier
            }
        });

        if (!userResp.ok) {
            return Response.json({ 
                error: 'Failed to get user info',
                status: userResp.status
            }, { status: 500 });
        }

        const userData = await userResp.json();
        const username = userData.username;
        const role = userData.role;

        // Step 3: Get patient ID
        const patientsUrl = config.baseUrlCareLink + '/links/patients';
        const patientsResp = await fetch(patientsUrl, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'mag-identifier': user.carelink_mag_identifier
            }
        });

        if (!patientsResp.ok) {
            return Response.json({ 
                error: 'Failed to get patient list',
                status: patientsResp.status
            }, { status: 500 });
        }

        const patientsData = await patientsResp.json();
        
        if (!patientsData || patientsData.length === 0) {
            return Response.json({ error: 'No patients found in account' }, { status: 404 });
        }

        const patientId = patientsData[0].relativeId;

        // Step 4: Get recent data
        const dataUrl = config.baseUrlCumulus + '/connect/carepartner/v11/display/message';
        const dataResp = await fetch(dataUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'mag-identifier': user.carelink_mag_identifier
            },
            body: JSON.stringify({
                username: username,
                role: role,
                patientId: patientId
            })
        });

        if (!dataResp.ok) {
            return Response.json({ 
                error: 'Failed to get patient data',
                status: dataResp.status
            }, { status: 500 });
        }

        const data = await dataResp.json();

        // Extract glucose reading from the response
        const lastSG = data?.lastSG;
        
        if (!lastSG || !lastSG.sg) {
            return Response.json({ error: 'No glucose data available' }, { status: 404 });
        }

        const glucoseValue = lastSG.sg;
        const timestamp = lastSG.datetime || new Date().toISOString();
        
        // Map trend
        const trendMap = {
            'NONE': 'FLAT',
            'UP': 'UP',
            'DOWN': 'DOWN',
            'UP_UP': 'UP_DOUBLE',
            'DOWN_DOWN': 'DOWN_DOUBLE',
            'FLAT': 'FLAT'
        };
        const trend = trendMap[lastSG.trendArrow] || 'FLAT';

        // Store reading
        const reading = await base44.asServiceRole.entities.BGReading.create({
            glucose_value: glucoseValue,
            timestamp: timestamp,
            trend: trend,
            active_insulin: data?.lastAlarm?.activeInsulin,
            pump_battery: data?.pumpBannerState?.batteryLevelPercent,
            sensor_duration: data?.lastSensorTS?.duration
        });

        // Check alerts
        const settings = await base44.asServiceRole.entities.AlertSettings.list();
        const alertSettings = settings[0];

        if (alertSettings?.alert_email) {
            const glucose = glucoseValue;
            const alerts = [];

            if (alertSettings.high_alert_enabled && glucose > alertSettings.high_threshold) {
                alerts.push(`High BG: ${glucose} mg/dL`);
            }

            if (alertSettings.low_alert_enabled && glucose < alertSettings.low_threshold) {
                alerts.push(`Low BG: ${glucose} mg/dL`);
            }

            const previousReadings = await base44.asServiceRole.entities.BGReading.list('-timestamp', 2);
            if (previousReadings.length > 1) {
                const previous = previousReadings[1];
                const change = glucose - previous.glucose_value;
                const timeDiff = (new Date(reading.timestamp) - new Date(previous.timestamp)) / 60000;

                if (timeDiff <= 15) {
                    if (alertSettings.rapid_rise_enabled && change >= alertSettings.rapid_rise_threshold) {
                        alerts.push(`Rapid rise: +${change.toFixed(0)} mg/dL`);
                    }
                    if (alertSettings.rapid_fall_enabled && change <= -alertSettings.rapid_fall_threshold) {
                        alerts.push(`Rapid fall: ${change.toFixed(0)} mg/dL`);
                    }
                }
            }

            if (alerts.length > 0) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: alertSettings.alert_email,
                    subject: `BG Alert: ${alerts[0]}`,
                    body: `
                        <h2>Blood Glucose Alert</h2>
                        <p><strong>Current BG:</strong> ${glucose} mg/dL</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</p>
                        <hr>
                        ${alerts.map(a => `<p>⚠️ ${a}</p>`).join('')}
                    `
                });
            }
        }

        return Response.json({
            success: true,
            reading: reading,
            glucose: glucoseValue,
            trend: trend,
            method: 'carelink-oauth-api'
        });

    } catch (error) {
        console.error('CareLink error:', error);
        return Response.json({
            error: error.message,
            details: error.stack
        }, { status: 500 });
    }
});