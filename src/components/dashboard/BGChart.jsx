import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { toMmol } from '@/utils/bgUnits';

export default function BGChart({ readings, settings }) {
    const isMmol = (settings?.bg_unit ?? 'mmol') === 'mmol';
    const chartData = [...readings]
        .reverse()
        .slice(-24)
        .map(reading => ({
            time: format(new Date(reading.timestamp), 'HH:mm'),
            glucose: isMmol ? toMmol(reading.glucose_value) : reading.glucose_value,
            timestamp: reading.timestamp
        }));

    const domain = isMmol ? [2.2, 14] : [40, 250];
    const unit = isMmol ? 'mmol/L' : 'mg/dL';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Blood Glucose Trend</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                        <YAxis domain={domain} tick={{ fontSize: 12 }} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }}
                            labelFormatter={(label) => `Time: ${label}`}
                            formatter={(value) => [`${value} ${unit}`, 'Glucose']}
                        />
                        {settings?.high_threshold && (
                            <ReferenceLine 
                                y={settings.high_threshold} 
                                stroke="#f97316" 
                                strokeDasharray="3 3"
                                label={{ value: 'High', position: 'right', fill: '#f97316' }}
                            />
                        )}
                        {settings?.low_threshold && (
                            <ReferenceLine 
                                y={settings.low_threshold} 
                                stroke="#dc2626" 
                                strokeDasharray="3 3"
                                label={{ value: 'Low', position: 'right', fill: '#dc2626' }}
                            />
                        )}
                        <Line 
                            type="monotone" 
                            dataKey="glucose" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}