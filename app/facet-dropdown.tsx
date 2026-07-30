type FacetDropdownProps = {
  count: number;
  isOpen: boolean;
  items: string[];
  label: string;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
  onSelectAll: () => void;
  onToggleItem: (item: string) => void;
  selected: Set<string>;
  total: number;
  valueCounts: Record<string, number>;
};

export function FacetDropdown({
  count,
  isOpen,
  items,
  label,
  onClear,
  onOpenChange,
  onSelectAll,
  onToggleItem,
  selected,
  total,
  valueCounts,
}: FacetDropdownProps) {
  return (
    <details
      className="top-dropdown wide"
      open={isOpen}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary>
        <span>{label}</span>
        <small>
          {count}/{total}
        </small>
      </summary>
      <div className="menu-panel check-panel">
        <div className="facet-actions" aria-label={`Acciones de ${label.toLowerCase()}`}>
          <button type="button" onClick={onSelectAll}>
            Seleccionar todos
          </button>
          <button type="button" onClick={onClear}>
            Deseleccionar todos
          </button>
        </div>
        {items.map((item) => (
          <label className="facet-option compact" key={item}>
            <input type="checkbox" checked={selected.has(item)} onChange={() => onToggleItem(item)} />
            <span className="facet-check" aria-hidden="true" />
            <span className="facet-name">{item}</span>
            <small>{valueCounts[item] ?? 0}</small>
          </label>
        ))}
      </div>
    </details>
  );
}
