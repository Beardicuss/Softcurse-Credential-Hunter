import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RouterOutput = inferRouterOutputs<AppRouter>;
type HunterStatus = RouterOutput["hunter"]["getStatus"];
type AddableValidity = "valid" | "unknown";

export interface AddKeyRequest {
  provider: string;
  keyValue: string;
  validity: AddableValidity;
}

export function ProviderPoolStatus({
  status,
  contractVersion,
  isAdding,
  onAddKey,
}: {
  status: HunterStatus;
  contractVersion: string;
  isAdding: boolean;
  onAddKey: (request: AddKeyRequest) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [validity, setValidity] = useState<AddableValidity>("unknown");

  const reset = () => {
    setProvider("");
    setKeyValue("");
    setValidity("unknown");
  };

  const submit = async () => {
    const added = await onAddKey({ provider, keyValue, validity });
    if (!added) return;
    reset();
    setOpen(false);
  };

  return (
    <div className="glass-panel p-6">
      <div className="data-text data-cyan mb-4 tracking-widest uppercase border-b border-[var(--c-border)] pb-2 flex justify-between items-center">
        <span><span className="decorator" />Provider Pool Status</span>
        <Button variant="outline" className="h-8 border-[var(--c-cyan)] text-[var(--c-cyan)] hover:bg-[var(--c-cyan)] hover:text-black" onClick={() => setOpen(open => !open)}>
          <Plus className="h-4 w-4 mr-2" />ADD KEY
        </Button>
      </div>

      {open && (
        <div className="glass-panel border border-[var(--c-cyan)] bg-[var(--c-bg)] p-4 mb-4">
          <div className="data-text data-cyan mb-3 tracking-widest uppercase">ADD NEW KEY</div>
          <div className="grid gap-3">
            <Input placeholder="Provider (e.g. OpenAI)" className="glass-panel text-[var(--c-text)] data-text" value={provider} onChange={event => setProvider(event.target.value)} />
            <Input placeholder="API Key Value" type="password" className="glass-panel text-[var(--c-text)] data-text" value={keyValue} onChange={event => setKeyValue(event.target.value)} />
            <Select onValueChange={value => setValidity(value as AddableValidity)} value={validity}>
              <SelectTrigger className="glass-panel !mb-2 data-text"><SelectValue placeholder="Validity Status" /></SelectTrigger>
              <SelectContent className="glass-panel bg-[var(--c-bg)] border-[var(--c-cyan)]">
                <SelectItem value="valid" className="data-text text-green-500">valid</SelectItem>
                <SelectItem value="unknown" className="data-text text-yellow-500">unknown</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button className="flex-1 bg-[var(--c-cyan)] text-black hover:bg-[var(--c-cyan-soft)] font-mono tracking-widest" onClick={submit} disabled={isAdding || !provider.trim() || !keyValue.trim()}>
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "[ INJECT KEY ]"}
              </Button>
              <Button variant="outline" className="border-[var(--c-border)] text-[var(--c-cyan-dim)]" onClick={() => { reset(); setOpen(false); }}>CANCEL</Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-sm data-text">
        <StatusMetric label="Service" value={status.status.toUpperCase()} tone="text-green-400" />
        <StatusMetric label="Providers" value={status.providers} tone="text-[var(--c-cyan)]" />
        <StatusMetric label="Valid keys" value={status.validKeys} tone="text-green-400" />
        <StatusMetric label="Contract" value={contractVersion} tone="text-[var(--c-orange)]" />
      </div>
    </div>
  );
}

function StatusMetric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="border border-[var(--c-border)] px-4 py-3">
      <div className="text-[var(--c-cyan-dim)] text-xs uppercase">{label}</div>
      <div className={`${tone} mt-1`}>{value}</div>
    </div>
  );
}
