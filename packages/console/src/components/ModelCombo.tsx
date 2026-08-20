// 按需 popover 的模型选择器:点击即全量列表,打字过滤。页面级一次只展开一个槽。
// popover 内嵌形态(surface=inset)不另起浮层。

import { useEffect, useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { filterModelOptions } from "../lib/resourcePlans";
import { SETUP_COPY } from "../lib/setupCopy";
import { modelSourceLabel, type CliModelOption } from "../lib/setupApi";

const inputStyle: CSSProperties = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: "var(--surface-control)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-mono)",
  boxSizing: "border-box"
};

/** 搜索命中高亮;query 为空则原样返回。 */
export function highlightModelText(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const lower = text.toLowerCase();
  const q = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let nth = 0;
  let index = lower.indexOf(q, start);
  while (index >= 0) {
    if (index > start) parts.push(text.slice(start, index));
    parts.push(
      <span key={`hl-${nth}`} data-hl="" style={{ background: "var(--active-ink-wash)", color: "inherit" }}>
        {text.slice(index, index + needle.length)}
      </span>
    );
    nth += 1;
    start = index + needle.length;
    index = lower.indexOf(q, start);
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts.length === 1 ? parts[0] : parts;
}

export function nextComboActiveIndex(
  current: number,
  key: "ArrowDown" | "ArrowUp",
  length: number
): number {
  if (length <= 0) return 0;
  if (key === "ArrowDown") return Math.min(length - 1, current + 1);
  return Math.max(0, current - 1);
}

/** 未打字时过滤词为空,避免用已选模型 id 把全量列表收成一项。 */
export function comboFilterQuery(value: string, typing: boolean): string {
  return typing ? value : "";
}

export function ModelCombo({
  models,
  value,
  onChange,
  complete,
  placeholder,
  open,
  onOpenChange,
  disabled,
  hint,
  slotKey,
  surface = "overlay"
}: {
  models: CliModelOption[];
  value: string;
  onChange: (id: string) => void;
  complete: boolean;
  placeholder?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  hint?: string;
  slotKey?: string;
  /** overlay=页面级浮层;inset=popover 内嵌,不另起一层 */
  surface?: "overlay" | "inset";
}) {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!open) setTyping(false);
  }, [open]);
  const filterQuery = comboFilterQuery(value, typing);
  const filtered = useMemo(() => filterModelOptions(models, filterQuery), [models, filterQuery]);
  const exactHit = models.some((model) => model.id === value.trim());
  const listId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        onOpenChange(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((current) =>
        nextComboActiveIndex(current, event.key === "ArrowUp" ? "ArrowUp" : "ArrowDown", filtered.length)
      );
      return;
    }
    if (event.key === "Enter" && open && filtered[safeIndex]) {
      event.preventDefault();
      onChange(filtered[safeIndex].id);
      onOpenChange(false);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    }
  };

  const matchCopy = `匹配 ${filtered.length} / ${models.length}${
    !complete && !exactHit && value.trim() ? SETUP_COPY.comboMatchExtra : ""
  }`;
  const inset = surface === "inset";

  return (
    <div
      data-model-combo={slotKey}
      data-open={open ? "1" : "0"}
      data-combo-surface={surface}
      data-overlay-trigger={inset ? undefined : "model"}
      style={{ position: "relative", zIndex: open && !inset ? "var(--z-setup-overlay)" : "auto" }}
    >
      <div style={{ position: "relative" }}>
        <input
          style={inputStyle}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            setTyping(true);
            setActiveIndex(0);
            if (!open) onOpenChange(true);
          }}
          onFocus={() => onOpenChange(true)}
          onKeyDown={onKeyDown}
          placeholder={
            placeholder ??
            (complete ? SETUP_COPY.comboPlaceholderComplete(models.length) : SETUP_COPY.comboPlaceholderPartial(models.length))
          }
          data-field="model-search"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          {...(open && filtered[safeIndex] ? { "aria-activedescendant": `${listId}-${safeIndex}` } : {})}
        />
        {open && models.length > 0 ? (
          <div
            data-model-popover
            data-fusion-overlay={inset ? undefined : "model"}
            style={
              inset
                ? {
                    position: "relative",
                    marginTop: 4,
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-xs)"
                  }
                : {
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: "var(--z-setup-overlay)",
                    marginTop: 4,
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-xs)",
                    boxShadow: "var(--shadow-card-hover)"
                  }
            }
          >
            <div id={listId} role="listbox" style={{ maxHeight: 320, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <p style={{ margin: 0, padding: "10px 12px", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  {complete ? SETUP_COPY.comboEmptyComplete : SETUP_COPY.comboEmptyPartial}
                </p>
              ) : (
                filtered.map((model, index) => {
                  const active = model.id === value.trim() || index === safeIndex;
                  const tag = modelSourceLabel(model);
                  return (
                    <button
                      key={model.id}
                      id={`${listId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={model.id === value.trim()}
                      disabled={disabled}
                      onClick={() => {
                        onChange(model.id);
                        onOpenChange(false);
                      }}
                      data-model-option={model.id}
                      data-active={active ? "1" : undefined}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        border: "none",
                        borderBottom: "1px solid var(--line)",
                        background: active ? "var(--selected-wash)" : "transparent",
                        color: "var(--text-primary)",
                        cursor: disabled ? "not-allowed" : "pointer",
                        fontSize: "var(--text-sm)"
                      }}
                    >
                      <span style={{ minWidth: 0, display: "grid", gap: 2 }}>
                        <span style={{ fontFamily: "var(--font-mono)" }}>{highlightModelText(model.id, filterQuery)}</span>
                        {model.label ? (
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: active ? "var(--text-secondary)" : "var(--text-muted)"
                            }}
                          >
                            {highlightModelText(model.label, filterQuery)}
                          </span>
                        ) : null}
                      </span>
                      {tag ? (
                        <span style={{ flex: "0 0 auto", fontSize: "var(--text-xs)", opacity: 0.7 }}>{tag}</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
            <p
              data-model-match-count
              style={{
                margin: 0,
                padding: "6px 12px",
                borderTop: "1px solid var(--line)",
                fontSize: "var(--text-xs)",
                color: "var(--text-faint)"
              }}
            >
              {matchCopy}
            </p>
          </div>
        ) : null}
      </div>
      {hint ? (
        <p style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>{hint}</p>
      ) : null}
    </div>
  );
}
