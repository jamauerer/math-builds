type PadProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function NumberPad({ value, onChange, onSubmit }: PadProps) {
  function append(digit: string) {
    onChange(`${value}${digit}`.slice(0, 8));
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "delete", "0", "enter"];

  return (
    <div className="pad">
      <div className="pad-display" aria-live="polite">
        {value.length > 0 ? value : " "}
      </div>
      <div className="pad-keys">
        {keys.map((key) => {
          if (key === "delete") {
            return (
              <button key={key} type="button" className="pad-key" onPointerUp={() => onChange(value.slice(0, -1))}>
                Delete
              </button>
            );
          }
          if (key === "enter") {
            return (
              <button key={key} type="button" className="pad-key pad-enter" onPointerUp={onSubmit}>
                Check
              </button>
            );
          }
          return (
            <button key={key} type="button" className="pad-key" onPointerUp={() => append(key)}>
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
