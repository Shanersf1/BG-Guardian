import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
    const location = useLocation();
    // No-op for local app - previously logged to Base44
    return null;
}
