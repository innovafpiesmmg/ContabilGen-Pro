import { type Request, type Response, type NextFunction } from "express";

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado." });
    return;
  }
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "Acceso denegado. Se requieren permisos de administrador." });
    return;
  }
  next();
}
