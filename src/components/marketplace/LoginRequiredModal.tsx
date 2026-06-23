import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  redirectTo?: string;
}

export default function LoginRequiredModal({ open, onOpenChange, redirectTo }: Props) {
  const navigate = useNavigate();
  const go = (path: string) => {
    onOpenChange(false);
    if (redirectTo) {
      try { sessionStorage.setItem("post_login_redirect", redirectTo); } catch { /* ignore */ }
    }
    navigate(path);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Faça login para comprar</DialogTitle>
          <DialogDescription>
            Você precisa estar logado para realizar compras. Faça login ou crie uma conta.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={() => go("/login")} className="w-full justify-center">
            <LogIn className="w-4 h-4 mr-2" /> Fazer Login
          </Button>
          <Button variant="outline" onClick={() => go("/signup")} className="w-full justify-center">
            <UserPlus className="w-4 h-4 mr-2" /> Criar Conta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
