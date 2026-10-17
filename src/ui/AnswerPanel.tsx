import { useState } from "react";
import type { Problem } from "../engine/types";
import { NumberPad } from "./NumberPad";

type Props = {
  problem: Problem;
  locked: boolean;
  onSubmit: (answer: string) => void;
};

export function AnswerPanel({ problem, locked, onSubmit }: Props) {
  const [typed, setTyped] = useState("");

  if (problem.choices && problem.choices.length > 0) {
    return (
      <div className="choices">
        {problem.choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className="choice"
            disabled={locked}
            onPointerUp={() => {
              if (!locked) {
                onSubmit(choice);
              }
            }}
          >
            {choice}
          </button>
        ))}
      </div>
    );
  }

  return (
    <NumberPad
      value={typed}
      onChange={setTyped}
      onSubmit={() => {
        if (!locked && typed.length > 0) {
          onSubmit(typed);
        }
      }}
    />
  );
}
