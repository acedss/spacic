import { useClerk } from "@clerk/clerk-react";
import { Button } from "./button";
import { LogIn } from "lucide-react";

const SignInOAuthButtons = () => {
    const { openSignIn } = useClerk();

    const handleSignIn = () => {
        openSignIn({
            fallbackRedirectUrl: '/auth-callback'
        });
    };

    return <Button onClick={handleSignIn} variant={'default'} className=" w-fit text-purple-400 bg-indigo-950  shadow-black border-zinc-200 h-11">Sign in<LogIn className="w-5 h-5" /></Button>

}
export default SignInOAuthButtons