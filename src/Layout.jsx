import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Activity, BarChart2, Link2, Settings } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden w-full max-w-full">
            {/* Navigation */}
            <nav className="bg-white border-b sticky top-0 z-50 w-full overflow-hidden">
                <div className="w-full max-w-full mx-auto px-3 sm:px-4">
                    <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
                        <Link to={createPageUrl('Dashboard')} className="flex items-center gap-1.5 shrink-0 min-w-0">
                            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
                            <span className="text-lg sm:text-xl font-bold text-gray-800 truncate">BG Monitor</span>
                        </Link>
                        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 shrink">
                            <Link
                                to={createPageUrl('Dashboard')}
                                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-sm flex items-center gap-1 shrink-0 ${
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
                                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-sm flex items-center gap-1 shrink-0 ${
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
                                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors flex items-center gap-1 text-sm shrink-0 ${
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
            <div className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden">
                <div className="flex-1 w-full max-w-full overflow-x-hidden">{children}</div>
                <footer className="py-4 text-center text-sm text-gray-500 border-t bg-white">
                    © {new Date().getFullYear()} SKF
                </footer>
            </div>
        </div>
    );
}