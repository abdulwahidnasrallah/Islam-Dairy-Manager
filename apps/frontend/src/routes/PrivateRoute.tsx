import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/store/authContext";

export function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-gray-400">
        جاري التحقق من الجلسة...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
