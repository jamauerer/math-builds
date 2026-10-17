import { useState } from "react";
import type { Problem } from "../engine/types";
import { NumberPad } from "./NumberPad";

type Props = {
  problem: Problem;
  locked: boolean;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
};

export function AnswerPanel({ problem, locked, onSubmit, onSkip }: Props) {
  const [typed, setTyped] = useState("");

  return (
    <div className="answer-block">
      {problem.choices && problem.choices.length > 0 ? (
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
      ) : (
        <NumberPad
          value={typed}
          onChange={setTyped}
          onSubmit={() => {
            if (!locked && typed.length > 0) {
              onSubmit(typed);
            }
          }}
        />
      )}
      <button
        type="button"
        className="choice skip"
        disabled={locked}
        onPointerUp={() => {
          if (!locked) {
            onSkip();
          }
        }}
      >
        I don't know yet
      </button>
    </div>
  );
}
