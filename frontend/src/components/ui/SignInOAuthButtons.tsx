import { useSignIn } from "@clerk/clerk-react"
import { Button } from "./button"
import { LogIn } from "lucide-react"

const SignInOAuthButtons = () => {
    const { signIn, isLoaded } = useSignIn()

    if (!isLoaded) {
        return null
    }

    const signInWithGoogle = () => {
        signIn.authenticateWithRedirect({
            strategy: "oauth_google",
            redirectUrl: "/sso-callback",
            redirectUrlComplete: "/auth-callback",
        })
    }

    return <Button onClick={signInWithGoogle} variant={"secondary"} className="w-full text-purple-400 border-zinc-200 h-11">Log-in<LogIn className="w-5 h-5" /></Button>
}

export default SignInOAuthButtons