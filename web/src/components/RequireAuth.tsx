import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../api/types";

export function RequireAuth({ children, role }: { children: React.ReactNode; role?: Role }) {
  const { member, loading } = useAuth();

  if (loading) return null;
  if (!member) return <Navigate to="/login" replace />;
  if (role && member.role !== role) return <Navigate to="/" replace />;

  return <>{children}</>;
}
