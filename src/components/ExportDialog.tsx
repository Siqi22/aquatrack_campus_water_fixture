import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileText } from "lucide-react";
import {
  EXPORT_COLUMNS,
  EXPORT_TEMPLATES,
  DEFAULT_EXPORT_KEYS,
  exportToCSV,
  type ExportColumnKey,
} from "@/lib/exportCSV";
import type { Fixture, Campus } from "@/store/fixtureStore";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fixtures: Fixture[];
  campuses: Campus[];
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "all-campuses"
  );
}

function ExportDialogBody({
  templateId,
  setTemplateId,
  selected,
  setSelected,
  campusOptions,
  campusToken,
  setCampusToken,
  dateToken,
  setDateToken,
  includeTemplate,
  setIncludeTemplate,
  customSuffix,
  setCustomSuffix,
  filename,
  filteredFixtures,
  fixtures,
  applyTemplate,
  toggle,
  selectAllColumns,
  selectNoColumns,
  previewCols,
  sampleValues,
  sampleRow,
  download,
}: {
  templateId: string;
  setTemplateId: (v: string) => void;
  selected: ExportColumnKey[];
  setSelected: (
    v: ExportColumnKey[] | ((p: ExportColumnKey[]) => ExportColumnKey[]),
  ) => void;
  campusOptions: { id: string; name: string }[];
  campusToken: string;
  setCampusToken: (v: string) => void;
  dateToken: string;
  setDateToken: (v: string) => void;
  includeTemplate: boolean;
  setIncludeTemplate: (v: boolean) => void;
  customSuffix: string;
  setCustomSuffix: (v: string) => void;
  filename: string;
  filteredFixtures: Fixture[];
  fixtures: Fixture[];
  applyTemplate: (id: string) => void;
  toggle: (k: ExportColumnKey) => void;
  selectAllColumns: () => void;
  selectNoColumns: () => void;
  previewCols: typeof EXPORT_COLUMNS;
  sampleValues: string[] | null;
  sampleRow: Fixture | undefined;
  download: (keys: ExportColumnKey[]) => void;
}) {
  const previewRows = previewCols.slice(0, 5);

  return (
    <div className="space-y-4 pb-1">
      <section>
        <p className="section-label mb-2">Template</p>
        <div className="overflow-hidden rounded-xl border bg-card divide-y">
          {EXPORT_TEMPLATES.map((t) => {
            const active = templateId === t.id;
            return (
              <div
                key={t.id}
                className={`flex items-center gap-2 px-2.5 py-2 ${active ? "bg-primary/5" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span
                    className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}
                  >
                    {t.label}
                  </span>
                </button>
                <button
                  type="button"
                  title={`Download ${t.label}`}
                  onClick={() => {
                    applyTemplate(t.id);
                    download(t.keys);
                  }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2.5 border-t pt-4">
        <p className="section-label">Filename</p>
        <label className="field-label block">
          <span className="block">Campus</span>
          <div className="field-control">
            <select
              value={campusToken}
              onChange={(e) => setCampusToken(e.target.value)}
              className="field-input"
            >
              <option value="all">All campuses</option>
              {campusOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="field-label block">
          <span className="block">Date</span>
          <div className="field-control">
            <input
              type="date"
              value={dateToken}
              onChange={(e) => setDateToken(e.target.value)}
              className="field-input"
            />
          </div>
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox
            checked={includeTemplate}
            onCheckedChange={(v) => setIncludeTemplate(!!v)}
          />
          Include template ({templateId})
        </label>
        <input
          value={customSuffix}
          onChange={(e) => setCustomSuffix(e.target.value)}
          placeholder="Custom suffix (optional)"
          className="field-input"
        />
        <div className="rounded-xl border px-3 py-2">
          <p className="break-all font-mono text-caption text-foreground">{filename}</p>
          <p className="mt-0.5 text-micro text-muted-foreground">
            {filteredFixtures.length} of {fixtures.length} fixtures
          </p>
        </div>
      </section>

      <section className="border-t pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="section-label">{selected.length} columns</p>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="font-semibold text-primary"
              onClick={selectAllColumns}
            >
              All
            </button>
            <button
              type="button"
              className="font-medium text-muted-foreground"
              onClick={selectNoColumns}
            >
              None
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border divide-y">
          {EXPORT_COLUMNS.map((c) => {
            const checked = selected.includes(c.key);
            return (
              <label
                key={c.key}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs ${
                  checked ? "bg-primary/[0.03]" : ""
                }`}
                onMouseDown={(e) => e.preventDefault()}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(c.key)} />
                <span className="font-medium text-foreground">{c.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="border-t pt-4">
        <p className="section-label mb-2 flex items-center gap-1.5">
          <FileText className="h-3 w-3" /> Preview · {previewCols.length} cols
        </p>
        {previewCols.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-3 text-center text-caption text-muted-foreground">
            Select at least one column.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border divide-y">
            {previewRows.map((c, i) => (
              <div
                key={c.key}
                className="flex items-start justify-between gap-3 px-3 py-2"
              >
                <span className="min-w-0 flex-1 text-caption font-medium text-muted-foreground">
                  {c.label}
                </span>
                <span className="max-w-[55%] break-words text-right text-caption font-medium text-foreground">
                  {sampleValues ? sampleValues[i] || "—" : "sample"}
                </span>
              </div>
            ))}
            {previewCols.length > previewRows.length && (
              <p className="px-3 py-1.5 text-micro text-muted-foreground">
                + {previewCols.length - previewRows.length} more
              </p>
            )}
          </div>
        )}
        {sampleRow && previewCols.length > 0 && (
          <p className="mt-1 text-micro text-muted-foreground">Sample from first fixture.</p>
        )}
      </section>
    </div>
  );
}

export function ExportDialog({
  open,
  onOpenChange,
  fixtures,
  campuses,
}: Props) {
  const [templateId, setTemplateId] = useState<string>("default");
  const [selected, setSelected] =
    useState<ExportColumnKey[]>(DEFAULT_EXPORT_KEYS);

  const today = new Date().toISOString().split("T")[0];
  const campusOptions = useMemo(() => {
    const ids = Array.from(new Set(fixtures.map((f) => f.campusId)));
    return ids.map((id) => ({
      id,
      name: campuses.find((c) => c.id === id)?.name ?? "Unknown",
    }));
  }, [fixtures, campuses]);

  const [campusToken, setCampusToken] = useState<string>("all");
  const [dateToken, setDateToken] = useState<string>(today);
  const [includeTemplate, setIncludeTemplate] = useState(true);
  const [customSuffix, setCustomSuffix] = useState("");

  useEffect(() => {
    if (open) {
      setCampusToken("all");
      setDateToken(today);
      setIncludeTemplate(true);
      setCustomSuffix("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const campusMap = useMemo(() => {
    const m: Record<string, string> = {};
    campuses.forEach((c) => {
      m[c.id] = c.name;
    });
    return m;
  }, [campuses]);

  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  const preserveScroll = (action: () => void) => {
    scrollTopRef.current = bodyScrollRef.current?.scrollTop ?? 0;
    action();
  };

  useLayoutEffect(() => {
    const el = bodyScrollRef.current;
    if (el) el.scrollTop = scrollTopRef.current;
  }, [selected]);

  const applyTemplate = (id: string) => {
    preserveScroll(() => {
      setTemplateId(id);
      const tpl = EXPORT_TEMPLATES.find((t) => t.id === id);
      if (tpl) setSelected(tpl.keys);
    });
  };

  const toggle = (k: ExportColumnKey) => {
    preserveScroll(() => {
      setTemplateId("custom");
      setSelected((prev) =>
        prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
      );
    });
  };

  const selectAllColumns = () => {
    preserveScroll(() => {
      setTemplateId("custom");
      setSelected(EXPORT_COLUMNS.map((c) => c.key));
    });
  };

  const selectNoColumns = () => {
    preserveScroll(() => {
      setTemplateId("custom");
      setSelected([]);
    });
  };

  const previewCols = useMemo(
    () => EXPORT_COLUMNS.filter((c) => selected.includes(c.key)),
    [selected],
  );

  const sampleRow = fixtures[0];
  const sampleValues = useMemo(() => {
    if (!sampleRow) return null;
    return previewCols.map((c) =>
      String(
        c.get(sampleRow, { campusName: campusMap[sampleRow.campusId] }) ?? "",
      ),
    );
  }, [previewCols, sampleRow, campusMap]);

  const filename = useMemo(() => {
    const parts: string[] = ["fixtures"];
    if (campusToken === "all") parts.push("all");
    else
      parts.push(
        slug(campusOptions.find((c) => c.id === campusToken)?.name ?? "campus"),
      );
    if (includeTemplate) parts.push(slug(templateId));
    if (customSuffix.trim()) parts.push(slug(customSuffix));
    if (dateToken) parts.push(dateToken);
    return `${parts.join("_")}.csv`;
  }, [
    campusToken,
    campusOptions,
    includeTemplate,
    templateId,
    customSuffix,
    dateToken,
  ]);

  const filteredFixtures = useMemo(
    () =>
      campusToken === "all"
        ? fixtures
        : fixtures.filter((f) => f.campusId === campusToken),
    [fixtures, campusToken],
  );

  const download = (keys: ExportColumnKey[]) => {
    if (keys.length === 0) {
      toast.error("Pick at least one column");
      return;
    }
    if (filteredFixtures.length === 0) {
      toast.error("No fixtures match the selected campus");
      return;
    }
    exportToCSV(filteredFixtures, keys, campusMap, filename);
    toast.success(`Exported ${filteredFixtures.length} fixtures`);
    onOpenChange(false);
  };

  const bodyProps = {
    templateId,
    setTemplateId,
    selected,
    setSelected,
    campusOptions,
    campusToken,
    setCampusToken,
    dateToken,
    setDateToken,
    includeTemplate,
    setIncludeTemplate,
    customSuffix,
    setCustomSuffix,
    filename,
    filteredFixtures,
    fixtures,
    applyTemplate,
    toggle,
    selectAllColumns,
    selectNoColumns,
    previewCols,
    sampleValues,
    sampleRow,
    download,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-shell">
        <DialogHeader className="dialog-shell-header">
          <DialogTitle>Export CSV</DialogTitle>
          <p className="text-caption text-muted-foreground">
            Choose a template, adjust columns, download.
          </p>
        </DialogHeader>
        <div ref={bodyScrollRef} className="dialog-shell-body">
          <ExportDialogBody {...bodyProps} />
        </div>
        <DialogFooter className="dialog-shell-footer">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={() => download(selected)}
            className="w-full gap-1.5 text-primary-foreground sm:w-auto"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
