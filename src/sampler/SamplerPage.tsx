import { useMemo } from "react";
import { sampleLearnerQuestions } from "../ladder/sample";

export function SamplerPage() {
  const params = new URLSearchParams(window.location.search);
  const grade = Math.max(0, Math.min(13, Number(params.get("grade") ?? 1) || 1));
  const lines = useMemo(() => sampleLearnerQuestions(grade, 3), [grade]);
  return (
    <div className="sampler" style={{ padding: 24, maxWidth: 880, margin: "0 auto", fontFamily: "Georgia, serif" }}>
      <h1>Sampler · grade {grade}</h1>
      <p>60 questions as a learner would see them in placement and a first round.</p>
      <ol>
        {lines.map((line) => (
          <li key={`${line.n}-${line.prompt}`} data-step={line.stepId} data-phase={line.phase}>
            <code>{line.stepId}</code> {line.prompt}
          </li>
        ))}
      </ol>
    </div>
  );
}
