import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Activity, BarChart2, Link2, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export default function Layout({ children, currentPageName }) {
    const { isDark, toggleTheme } = useTheme();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 overflow-x-hidden w-full max-w-full transition-colors duration-200">
            {/* Navigation */}
            <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-50 w-full overflow-hidden transition-colors duration-200">
                <div className="w-full max-w-full mx-auto px-3 sm:px-4">
                    <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
                        <Link to={createPageUrl('Dashboard')} className="flex items-center gap-1.5 shrink-0 min-w-0">
                            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span className="text-lg sm:text-xl font-bold text-gray-800 dark:text-slate-100 truncate">BG Monitor</span>
                        </Link>
                        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 shrink">
                            <Link
                                to={createPageUrl('Dashboard')}
                                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 text-sm flex items-center gap-1 shrink-0 ${
                                    currentPageName === 'Dashboard'
                                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                <BarChart2 className="w-4 h-4 shrink-0" />
                                <span className="hidden sm:inline">Dashboard</span>
                            </Link>
                            <Link
                                to={createPageUrl('Connect')}
                                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 text-sm flex items-center gap-1 shrink-0 ${
                                    currentPageName === 'Connect'
                                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                <Link2 className="w-4 h-4 shrink-0" />
                                <span className="hidden sm:inline">Connect</span>
                            </Link>
                            <Link
                                to={createPageUrl('Settings')}
                                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 flex items-center gap-1 text-sm shrink-0 ${
                                    currentPageName === 'Settings'
                                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                <Settings className="w-4 h-4" />
                                <span className="hidden sm:inline">Settings</span>
                            </Link>
                            <button
                                type="button"
                                onClick={toggleTheme}
                                className="p-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 shrink-0"
                                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Page Content */}
            <div className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden">
                <div className="flex-1 w-full max-w-full overflow-x-hidden">{children}</div>
                <footer className="py-4 text-center text-sm text-gray-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors duration-200">
                    © {new Date().getFullYear()} SKF
                </footer>
            </div>
        </div>
    );
}