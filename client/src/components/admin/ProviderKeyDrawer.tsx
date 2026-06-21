import { useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RouterOutput = inferRouterOutputs<AppRouter>;
type ProviderKey = RouterOutput["hunter"]["getProviderKeys"][number];
export type KeyValidity = "valid" | "invalid" | "rate_limited" | "unknown";
export interface KeyEditRequest {
  id: number;
  keyValue?: string;
  validity: KeyValidity;
}

const fmtDate = (date: Date | string | null | undefined): string =>
  date ? new Date(date).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "—";

export function ProviderKeyDrawer({
  provider,
  keys,
  isLoading,
  revealedKeyIds,
  revealedValues,
  pendingKeyId,
  isEditing,
  onClose,
  onReveal,
  onCopy,
  onEdit,
  onValidate,
}: {
  provider: string;
  keys: ProviderKey[] | undefined;
  isLoading: boolean;
  revealedKeyIds: Set<number>;
  revealedValues: Map<number, string>;
  pendingKeyId: number | null;
  isEditing: boolean;
  onClose: () => void;
  onReveal: (keyId: number) => void;
  onCopy: (keyId: number) => void;
  onEdit: (request: KeyEditRequest) => void;
  onValidate: (keyId: number) => void;
}) {
  return (
    <div className="glass-panel p-6">
      <div className="data-text data-cyan mb-4 tracking-widest uppercase border-b border-[var(--c-border)] pb-2 flex items-center justify-between">
        <span><span className="decorator" />{provider} :: SYSTEM_KEYS</span>
        <div className="flex items-center gap-3">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin data-cyan" />}
          <button className="text-[var(--c-cyan-dim)] hover:text-[var(--c-cyan)] transition-colors" title="Close panel" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><span className="data-text data-cyan tracking-widest uppercase animate-pulse">FETCHING NODES...</span></div>
        ) : keys?.length ? (
          <div className="space-y-4">
            {keys.map(key => (
              <KeyRow
                key={key.id}
                keyRecord={key}
                revealed={revealedKeyIds.has(key.id)}
                revealedValue={revealedValues.get(key.id)}
                validating={pendingKeyId === key.id}
                isEditing={isEditing}
                onReveal={() => onReveal(key.id)}
                onCopy={() => onCopy(key.id)}
                onEdit={onEdit}
                onValidate={() => onValidate(key.id)}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 flex items-center justify-center border border-dashed border-[var(--c-border)] glass-panel">
            <p className="data-text uppercase tracking-widest text-[var(--c-cyan-dim)] text-xs flex items-center gap-2"><AlertCircle className="h-4 w-4" />NO KEYS DETECTED ON EXPANSE</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KeyRow({
  keyRecord,
  revealed,
  revealedValue,
  validating,
  isEditing,
  onReveal,
  onCopy,
  onEdit,
  onValidate,
}: {
  keyRecord: ProviderKey;
  revealed: boolean;
  revealedValue: string | undefined;
  validating: boolean;
  isEditing: boolean;
  onReveal: () => void;
  onCopy: () => void;
  onEdit: (request: KeyEditRequest) => void;
  onValidate: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [validity, setValidity] = useState<KeyValidity>(keyRecord.validity as KeyValidity);

  const submitEdit = () => {
    onEdit({ id: keyRecord.id, keyValue: keyValue || undefined, validity });
    setDialogOpen(false);
    setKeyValue("");
  };

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-[var(--c-border)] bg-[#050810] glass-panel group transition-all duration-300 hover:border-[var(--c-cyan-dim)]">
      <div className="flex-1 mb-4 md:mb-0">
        <div className="flex flex-wrap items-center gap-3 data-text">
          <button className="text-left text-lg text-[var(--c-text)] hover:text-[var(--c-cyan)] transition-colors select-all break-all" title="Reveal or hide full key" onClick={onReveal}>
            {revealedValue || keyRecord.keyMasked}
          </button>
          <button className="text-[var(--c-cyan)] hover:text-[var(--c-cyan-dim)] transition-colors flex items-center gap-1 text-xs font-mono border border-[var(--c-border)] px-2 py-1" title={revealed ? "Hide full key" : "Reveal full key"} onClick={onReveal}>
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{revealed ? "HIDE" : "REVEAL"}
          </button>
          {revealed && <button className="text-[var(--c-cyan)] hover:text-[var(--c-cyan-dim)] transition-colors flex items-center gap-1 text-xs font-mono border border-[var(--c-border)] px-2 py-1" title="Copy to clipboard" onClick={onCopy}><Copy className="h-3.5 w-3.5" />COPY</button>}
          <ValidityBadge validity={keyRecord.validity as KeyValidity} />
        </div>
        <div className="flex gap-4 mt-2 data-text text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">
          <p>PRB_COUNT: {keyRecord.usageCount}</p><p>CHK_TIME: {fmtDate(keyRecord.lastCheckedAt)}</p>
        </div>
      </div>
      <div className="flex flex-row gap-2 w-full md:w-auto">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="outline" className="h-9 w-9 border-[var(--c-border)] text-[var(--c-text)] hover:text-[var(--c-cyan)] hover:border-[var(--c-cyan)] cursor-pointer transition-colors" onClick={() => { setValidity(keyRecord.validity as KeyValidity); setKeyValue(""); }}><Edit2 className="h-4 w-4" /></Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-[var(--c-cyan)] bg-[var(--c-bg)]">
            <DialogHeader><DialogTitle className="data-text data-cyan flex items-center"><span className="decorator" />EDIT KEY: {keyRecord.keyMasked}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4 mt-2">
              <Input placeholder="New Value (leave blank to keep current)" type="password" className="glass-panel text-[var(--c-text)] data-text" value={keyValue} onChange={event => setKeyValue(event.target.value)} />
              <Select onValueChange={value => setValidity(value as KeyValidity)} value={validity}>
                <SelectTrigger className="glass-panel !mb-2 data-text"><SelectValue placeholder="Validity Status" /></SelectTrigger>
                <SelectContent className="glass-panel bg-[var(--c-bg)] border-[var(--c-cyan)]">
                  {(["valid", "invalid", "rate_limited", "unknown"] as KeyValidity[]).map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="w-full bg-[var(--c-cyan)] text-black hover:bg-[var(--c-cyan-soft)] mt-4 font-mono tracking-widest" onClick={submitEdit} disabled={isEditing}>
                {isEditing ? <Loader2 className="h-4 w-4 animate-spin" /> : "[ OVERWRITE KEY ]"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button size="icon" variant="outline" className="h-9 w-9 border-[var(--c-border)] text-[var(--c-text)] hover:text-[var(--c-cyan)] hover:border-[var(--c-cyan)] cursor-pointer transition-colors" onClick={onValidate} disabled={validating}>
          {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function ValidityBadge({ validity }: { validity: KeyValidity }) {
  if (validity === "valid") return <span className="text-xs border border-green-500 text-green-500 px-2 py-0.5 flex items-center gap-1"><CheckCircle className="h-3 w-3" />VALID</span>;
  if (validity === "invalid") return <span className="text-xs border border-[var(--c-magenta)] text-[var(--c-magenta)] px-2 py-0.5 flex items-center gap-1"><AlertCircle className="h-3 w-3" />INVALID</span>;
  if (validity === "rate_limited") return <span className="text-xs border border-yellow-500 text-yellow-500 px-2 py-0.5 flex items-center gap-1"><AlertCircle className="h-3 w-3" />RATE_LMT</span>;
  return <span className="text-xs border border-gray-500 text-gray-500 px-2 py-0.5">UNKNOWN</span>;
}