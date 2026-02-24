import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Activity, BarChart2, Link2, Settings } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation */}
            <nav className="bg-white border-b sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 shrink-0">
                            <Activity className="w-6 h-6 text-blue-600" />
                            <span className="text-xl font-bold text-gray-800">BG Monitor</span>
                        </Link>
                        <div className="flex items-center gap-2 md:gap-4 min-w-0 shrink">
                            <Link
                                to={createPageUrl('Dashboard')}
                                className={`px-3 md:px-4 py-2 rounded-lg transition-colors text-sm md:text-base flex items-center gap-1 shrink-0 ${
                                    currentPageName === 'Dashboard'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <BarChart2 className="w-4 h-4 shrink-0" />
                                <span className="hidden sm:inline">Dashboard</span>
                            </Link>
                            <Link
                                to={createPageUrl('Connect')}
                                className={`px-3 md:px-4 py-2 rounded-lg transition-colors text-sm md:text-base flex items-center gap-1 shrink-0 ${
                                    currentPageName === 'Connect'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <Link2 className="w-4 h-4 shrink-0" />
                                <span className="hidden sm:inline">Connect</span>
                            </Link>
                            <Link
                                to={createPageUrl('Settings')}
                                className={`px-3 md:px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm md:text-base shrink-0 ${
                                    currentPageName === 'Settings'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <Settings className="w-4 h-4" />
                                <span className="hidden sm:inline">Settings</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Page Content */}
            <div className="flex flex-col min-h-screen">
                <div className="flex-1">{children}</div>
                <footer className="py-4 text-center text-sm text-gray-500 border-t bg-white">
                    © {new Date().getFullYear()} SKF
                </footer>
            </div>
        </div>
    );
}