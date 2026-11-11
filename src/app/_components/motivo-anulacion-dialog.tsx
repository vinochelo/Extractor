"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, updateDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { RetentionRecord } from "@/lib/types";
import { MessageSquareWarning, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const MOTIVOS_FRECUENTES = [
  "Porcentaje de retención incorrecto",
  "Error en datos o monto de factura",
  "Retención emitida por duplicado",
  "Factura anulada por el proveedor",
  "Código de impuesto erróneo",
  "Emisión fuera de fecha / período",
];

interface MotivoAnulacionDialogProps {
  retention: RetentionRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (motivo: string) => void;
}

export function MotivoAnulacionDialog({
  retention,
  open,
  onOpenChange,
  onSaved,
}: MotivoAnulacionDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (retention && open) {
      setMotivo(retention.motivoAnulacion || "");
    }
  }, [retention, open]);

  const handleSelectPreset = (preset: string) => {
    setMotivo((prev) => {
      if (!prev.trim()) return preset;
      if (prev.includes(preset)) return prev;
      return `${prev.trim()} — ${preset}`;
    });
  };

  const handleSave = () => {
    const trimmed = motivo.trim();
    if (retention && retention.id && retention.id !== "temp-preview" && firestore && user?.uid) {
      const retentionRef = doc(
        firestore,
        `users/${user.uid}/retenciones`,
        retention.id
      );
      updateDocumentNonBlocking(retentionRef, {
        motivoAnulacion: trimmed,
      });
    }

    onSaved?.(trimmed);
    toast({
      title: "Motivo registrado",
      description: trimmed
        ? `Se guardó el motivo para la retención ${retention?.numeroRetencion}.`
        : "Se actualizó el registro sin motivo específico.",
    });
    onOpenChange(false);
  };

  if (!retention) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl border-2">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="p-2 rounded-xl bg-primary/10">
              <MessageSquareWarning className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-black tracking-tight">
              Motivo de Anulación
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm font-medium">
            Indica por qué se solicita anular la retención{" "}
            <span className="font-mono font-bold text-foreground">
              {retention.numeroRetencion}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-foreground">
              {retention.razonSocialProveedor}
            </span>
            . Esto quedará guardado en el historial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Motivos frecuentes (clic para agregar)
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_FRECUENTES.map((preset) => {
                const isSelected = motivo.includes(preset);
                return (
                  <Badge
                    key={preset}
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => handleSelectPreset(preset)}
                    className={cn(
                      "cursor-pointer py-1 px-2.5 text-xs font-semibold rounded-lg transition-all select-none",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted hover:border-primary/40"
                    )}
                  >
                    {isSelected && <Check className="mr-1 h-3 w-3" />}
                    {preset}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="motivo-textarea"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Detalle u observación manual
            </Label>
            <Textarea
              id="motivo-textarea"
              placeholder="Ej. Se aplicó el 2% en lugar del 1.75%, o indica cualquier detalle relevante para el seguimiento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="rounded-xl resize-none text-sm font-medium"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold text-xs"
          >
            Omitir por ahora
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="rounded-xl font-black text-xs px-5 shadow-md"
          >
            Guardar Motivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
