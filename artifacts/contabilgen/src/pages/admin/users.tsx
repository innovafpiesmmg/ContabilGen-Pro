import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Shield, ShieldOff, KeyRound, Search, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  createdAt: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error en la petición");
  return data;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/admin/users").then((d) => d.users as AdminUser[]),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      apiFetch(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Usuario eliminado" });
      setDeleteId(null);
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const handleResetPassword = async () => {
    if (!resetUser || newPassword.length < 8) return;
    try {
      await apiFetch(`/admin/users/${resetUser.id}`, { method: "PATCH", body: JSON.stringify({ newPassword }) });
      toast({ title: "Contraseña actualizada" });
      setResetUser(null);
      setNewPassword("");
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const filtered = (data ?? []).filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Gestión de usuarios</h1>
        <p className="text-sm text-muted-foreground mt-1">Administra las cuentas de usuario de la plataforma</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuario</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Registro</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rol</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground text-sm">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isMe = u.id === currentUser?.id;
                  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-sm text-foreground">{name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        {isMe && <span className="text-xs text-primary font-medium">(tú)</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("es-ES")}
                      </td>
                      <td className="px-6 py-4">
                        {u.isAdmin ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                            <Shield className="w-3 h-3 mr-1" /> Administrador
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Usuario</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {!isMe && (
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              title={u.isAdmin ? "Quitar admin" : "Hacer admin"}
                              onClick={() => patchMutation.mutate({ id: u.id, body: { isAdmin: !u.isAdmin } })}
                              disabled={patchMutation.isPending}
                            >
                              {u.isAdmin ? <ShieldOff className="w-4 h-4 text-muted-foreground" /> : <UserCheck className="w-4 h-4 text-primary" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Cambiar contraseña"
                              onClick={() => { setResetUser(u); setNewPassword(""); }}
                            >
                              <KeyRound className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Eliminar usuario"
                              onClick={() => setDeleteId(u.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. Se eliminarán la cuenta y todos sus datos (configuraciones, generaciones).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Asigna una nueva contraseña para <strong>{resetUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="newpw">Nueva contraseña (mínimo 8 caracteres)</Label>
            <Input
              id="newpw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={newPassword.length < 8}>
              Guardar contraseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
