import { Icon } from './icons';

/** Quiet search input with a clear button. The label is exposed to assistive tech only. */
export function SearchField(props: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="search-field">
      <Icon name="search" size={14} />
      <span className="sr-only">{props.label}</span>
      <input
        className="input search-input"
        type="search"
        spellCheck={false}
        value={props.value}
        placeholder={props.placeholder ?? 'Search…'}
        aria-label={props.label}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.value && (
        <button type="button" className="search-clear" aria-label="Clear search" onClick={() => props.onChange('')}>
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  );
}
