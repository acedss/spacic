import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';

/**
 * Wraps a route that requires authentication.
 * If the user is not signed in:
 *   1. Redirect to /
 *   2. Open Clerk sign-in modal with fallback back to the original path
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isSignedIn, isLoaded } = useAuth();
    const { openSignIn } = useClerk();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            navigate('/', { replace: true });
            openSignIn({ fallbackRedirectUrl: location.pathname });
        }
    }, [isLoaded, isSignedIn]);

    if (!isLoaded || !isSignedIn) return null;

    return <>{children}</>;
};

export default ProtectedRoute;
