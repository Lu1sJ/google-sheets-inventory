import { Card, CardContent } from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { CheckCircle, Shield, Award, Star } from "lucide-react";
import { useEffect } from "react";
// Background image removed for GitHub version
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { toast } = useToast();

  useEffect(() => {
    // Check for OAuth errors in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
      let errorMessage = "Authentication failed";
      switch (error) {
        case "oauth_failed":
          errorMessage = "Google authentication failed. Please try again.";
          break;
        case "no_code":
          errorMessage = "Authorization code not received from Google.";
          break;
        case "domain_not_allowed":
          errorMessage = "There was an authentication error. Please try again.";
          break;
        default:
          errorMessage = `Authentication error: ${error}`;
      }
      
      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Clear error from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" style={{
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      {/* Blurred overlay */}
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm"></div>
      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 rounded-lg mb-6 transition-transform hover:scale-105">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 font-sans">Sync 2 Inventory</h1>
          <p className="text-slate-600 mt-2 text-sm">NYPL</p>
        </div>

        {/* Authentication Card */}
        <Card className="shadow-lg border-gray-200 transition-shadow hover:shadow-xl">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-900">Demo Access</h2>
                <p className="text-slate-600 text-sm mt-2">Sign in with your authorized account</p>
              </div>

              <GoogleSignInButton />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
