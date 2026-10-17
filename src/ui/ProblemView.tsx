import type { Problem } from "../engine/types";

export function ProblemView({ problem }: { problem: Problem }) {
  const visual = problem.visual;
  return (
    <div className="problem">
      <p className="prompt">{problem.prompt}</p>
      {visual?.kind === "stacked" ? (
        <div className="stack" aria-label="Vertical problem">
          <div className="stack-top">{visual.top}</div>
          <div className="stack-op">{visual.operator === "x" ? "×" : visual.operator}</div>
          <div className="stack-bottom">{visual.bottom}</div>
          <div className="stack-line" />
        </div>
      ) : null}
      {visual?.kind === "compare" ? (
        <p className="compare-pair">
          {visual.left} or {visual.right}
        </p>
      ) : null}
    </div>
  );
}
