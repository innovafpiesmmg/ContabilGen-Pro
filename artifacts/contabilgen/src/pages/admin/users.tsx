import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Trash2, Shield, ShieldOff, KeyRound, Search,
  UserCheck, MoreHorizontal, Users, UserCog, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { AdminShell } from "@/components/admin-layout";

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  createdAt: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error en la petición");
  return data;
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-orange-100 text-orange-700",
];

function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function UserAvatar({ user }: { user: AdminUser }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : user.email.slice(0, 2).toUpperCase();
  const colorClass = getAvatarColor(user.email);
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${colorClass}`}>
      {initials}
    </div>
  );
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);

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
    setResettingPw(true);
    try {
      await apiFetch(`/admin/users/${resetUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword }),
      });
      toast({ title: "Contraseña actualizada", description: `Nueva contraseña guardada para ${resetUser.email}` });
      setResetUser(null);
      setNewPassword("");
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setResettingPw(false);
    }
  };

  const users = data ?? [];
  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = users.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length;
  const adminCount = users.filter((u) => u.isAdmin).length;

  const stats = [
    { label: "Total de usuarios", value: users.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Administradores", value: adminCount, icon: UserCog, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Nuevos (30 días)", value: recentCount, icon: CalendarDays, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <AdminShell
      title="Gestión de usuarios"
      description="Administra las cuentas de usuario de la plataforma"
    >
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {stats.map((s) => (
              <Card key={s.label} className="rounded-2xl shadow-sm border-border/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl bg-white"
            />
          </div>

          {/* Table */}
          <Card className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-slate-50/80">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuario</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Rol</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Registro</th>
                    <th className="px-5 py-3.5 w-14" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-14 text-muted-foreground text-sm">
                        No se encontraron usuarios
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u) => {
                      const isMe = u.id === currentUser?.id;
                      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <UserAvatar user={u} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm text-foreground truncate">{name ?? "Sin nombre"}</p>
                                  {isMe && <span className="text-[11px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full shrink-0">Tú</span>}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 hidden sm:table-cell">
                            {u.isAdmin ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 gap-1.5">
                                <Shield className="w-3 h-3" /> Administrador
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">Usuario</Badge>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">
                            {new Date(u.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {!isMe && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem
                                    onClick={() => patchMutation.mutate({ id: u.id, body: { isAdmin: !u.isAdmin } })}
                                    className="gap-2"
                                  >
                                    {u.isAdmin
                                      ? <><ShieldOff className="w-4 h-4 text-muted-foreground" /> Quitar privilegios admin</>
                                      : <><UserCheck className="w-4 h-4 text-primary" /> Hacer administrador</>
                                    }
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => { setResetUser(u); setNewPassword(""); }}
                                    className="gap-2"
                                  >
                                    <KeyRound className="w-4 h-4 text-muted-foreground" />
                                    Cambiar contraseña
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteId(u.id)}
                                    className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Eliminar usuario
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {filtered.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3 px-1">
              Mostrando {filtered.length} de {users.length} usuario{users.length !== 1 ? "s" : ""}
            </p>
          )}
        </>
      )}

      {/* Delete dialog */}
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
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password reset dialog */}
      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Cambiar contraseña
            </DialogTitle>
            <DialogDescription>
              Asigna una nueva contraseña para <strong className="text-foreground">{resetUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="newpw" className="text-sm font-medium">Nueva contraseña</Label>
            <Input
              id="newpw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="rounded-xl"
              onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
            />
            {newPassword.length > 0 && newPassword.length < 8 && (
              <p className="text-xs text-destructive">La contraseña debe tener al menos 8 caracteres.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetUser(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={newPassword.length < 8 || resettingPw} className="rounded-xl gap-2">
              {resettingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Guardar contraseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
