import { useEffect, useRef, useState } from "react";
import { art } from "../machines/bridge/kit/scene";
import type { ChoiceOption } from "../skills/generate";
import { hasSeenHand, markSeenHand, showHand, type PictureHelp } from "./pre-reader";

export function PictureCue({ kind }: { kind: PictureHelp }) {
  return (
    <div className="gk-picture-help" data-picture-help={kind} aria-hidden="true">
      {kind === "fill-box" ? (
        <span className="gk-cue gk-cue-box" />
      ) : null}
      {kind === "count-tray" ? (
        <span className="gk-cue gk-cue-tray">
          <b>3</b>
          <i />
          <i />
          <i />
          <em />
        </span>
      ) : null}
      {kind === "compare-piles" ? (
        <span className="gk-cue gk-cue-compare">
          <span data-pile="small">
            <i />
            <i />
          </span>
          <img src={art("goat-idle.png")} alt="" />
          <span data-pile="big">
            <i />
            <i />
            <i />
            <i />
          </span>
        </span>
      ) : null}
      {kind === "pattern-gap" ? (
        <span className="gk-cue gk-cue-pattern">
          <i data-shape="circle" />
          <i data-shape="square" />
          <i data-shape="circle" />
          <em />
        </span>
      ) : null}
    </div>
  );
}

export function HandDemo({ kind, force = false, mid = false }: { kind: PictureHelp; force?: boolean; mid?: boolean }) {
  const visible = showHand(kind, force);
  const marked = useRef(false);
  useEffect(() => {
    if (!visible || mid || marked.current || hasSeenHand(kind)) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      marked.current = true;
      markSeenHand(kind);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [kind, visible, mid]);
  if (!visible) {
    return null;
  }
  return (
    <div className={mid ? "gk-hand is-mid" : "gk-hand"} data-hand={kind} data-hand-demo="1" aria-hidden="true">
      <svg viewBox="0 0 48 48" width="48" height="48">
        <path
          d="M20 44c-6 0-10-3-10-9V20c0-2 1.4-3.2 3.2-3.2S16 18 16 20v6l1-14c0-2 1.5-3.3 3.3-3.3S24 10 24 12v12l1.2-10c0-2 1.6-3.2 3.4-3.2S32 12 32 14v10l1.4-6c0-2 1.7-3.1 3.4-3.1S40 16 40 18v16c0 7-5 10-12 10h-8z"
          fill="#f3d2a6"
          stroke="#5a4630"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function Piece({ kind }: { kind: "block" | "bolt" | "plank" }) {
  if (kind === "bolt") {
    return <img src={art("bolt.png")} alt="" />;
  }
  if (kind === "plank") {
    return <img className="gk-mini-plank" src={art("plank-side.png")} alt="" />;
  }
  return <span className="gk-block" />;
}

function NumeralDots({ count }: { count: number }) {
  const n = Math.max(0, Math.min(10, count));
  return (
    <span className="gk-num-dots" data-dots={n}>
      {Array.from({ length: n }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}

export function SilentCountPad({
  answer,
  draw,
  help,
  resetKey,
  onCommit,
  onFeel,
}: {
  answer: string;
  draw?: { op: string; a: number; b: number };
  help: PictureHelp;
  resetKey: string;
  onCommit: (attempt: string) => void;
  onFeel: (feel: "hop" | "slide") => void;
}) {
  const takeAway = draw?.op === "sub";
  const makeTen = draw?.op === "add" && draw.b > 0 && Number(answer) === draw.b && draw.a + draw.b === 10;
  const left = Math.max(0, draw?.a ?? Number(answer) ?? 0);
  const right = Math.max(0, draw?.b ?? 0);
  const startIn = takeAway || makeTen ? left : 0;
  const extras = help === "count-tray" && !takeAway && !makeTen ? Math.max(10, Number(answer) + 4) : 0;
  const shownNumeral = takeAway ? right : makeTen ? 10 : Number(answer);
  const target = takeAway ? right : makeTen ? 10 : Number(answer);
  const piece: "block" | "bolt" | "plank" = help === "count-tray" && !takeAway && !makeTen ? "bolt" : "block";
  const [inBox, setInBox] = useState(startIn);
  const [feel, setFeel] = useState<"" | "snap" | "slide">("");
  const locked = useRef(false);
  useEffect(() => {
    setInBox(startIn);
    setFeel("");
    locked.current = false;
  }, [resetKey, startIn]);
  useEffect(() => {
    if (locked.current || feel) {
      return;
    }
    const discarded = takeAway ? left - inBox : 0;
    const over = takeAway ? discarded > target : inBox > target;
    if (over) {
      setFeel("slide");
      onFeel("slide");
      const timer = window.setTimeout(() => {
        setInBox(startIn);
        setFeel("");
      }, 420);
      return () => window.clearTimeout(timer);
    }
    const done = takeAway ? discarded === target : inBox === target && Number.isFinite(target);
    if (done) {
      locked.current = true;
      setFeel("snap");
      onFeel("hop");
      const timer = window.setTimeout(() => onCommit(answer), 380);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [inBox, target, takeAway, left, startIn, answer, onCommit, onFeel, feel]);
  const remainLeft = takeAway || makeTen || extras > 0 ? 0 : Math.max(0, left - Math.min(inBox, left));
  const remainRight = takeAway || extras > 0 ? 0 : makeTen ? Math.max(0, right - Math.max(0, inBox - left)) : Math.max(0, right - Math.max(0, inBox - left));
  const remainExtra = extras > 0 ? Math.max(0, extras - inBox) : 0;
  const discard = takeAway ? Math.max(0, left - inBox) : 0;
  function addOne() {
    if (!locked.current) {
      setInBox((count) => (takeAway ? Math.max(0, count - 1) : count + 1));
    }
  }
  return (
    <div className={`gk-drag-count ${feel === "snap" ? "is-snap" : feel === "slide" ? "is-slide" : ""}`} data-action="drag-count" data-silent-pad={help}>
      {help === "count-tray" || makeTen ? (
        <div className="gk-count-head">
          <span className="gk-numeral" data-numeral={shownNumeral}>
            <b>{shownNumeral}</b>
            <NumeralDots count={shownNumeral} />
          </span>
        </div>
      ) : null}
      {remainExtra > 0 ? (
        <div className="gk-drag-tray" data-tray="spare">
          {Array.from({ length: remainExtra }, (_, index) => (
            <button key={`extra-${index}`} type="button" className="gk-drag-bolt" aria-label="Block" onClick={addOne}>
              <Piece kind={piece} />
            </button>
          ))}
        </div>
      ) : null}
      {remainLeft > 0 ? (
        <div className="gk-drag-tray" data-tray="left">
          {Array.from({ length: remainLeft }, (_, index) => (
            <button key={`left-${index}`} type="button" className="gk-drag-bolt" aria-label="Block" onClick={addOne}>
              <Piece kind={piece} />
            </button>
          ))}
        </div>
      ) : null}
      {remainRight > 0 ? (
        <div className="gk-drag-tray" data-tray="right">
          {Array.from({ length: remainRight }, (_, index) => (
            <button key={`right-${index}`} type="button" className="gk-drag-bolt" aria-label="Block" onClick={addOne}>
              <Piece kind={piece} />
            </button>
          ))}
        </div>
      ) : null}
      {takeAway ? (
        <div className="gk-drag-tray is-target" data-tray="discard" data-count={discard}>
          {Array.from({ length: discard }, (_, index) => (
            <span key={index} className={feel === "slide" ? "is-slide" : ""}>
              <Piece kind={piece} />
            </span>
          ))}
        </div>
      ) : null}
      <div
        className={`gk-drag-box is-target ${feel === "snap" ? "is-snap" : ""}`}
        data-count={inBox}
        onClick={() => {
          if (!locked.current && inBox > (takeAway ? 0 : startIn)) {
            setInBox((count) => count - 1);
          }
        }}
      >
        {Array.from({ length: inBox }, (_, index) => (
          <span key={index} className={feel === "slide" ? "is-slide" : ""}>
            <Piece kind={piece} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function ComparePilesPad({
  draw,
  answer,
  resetKey,
  onCommit,
  onFeel,
  kind = "block",
}: {
  draw?: { op: string; a: number; b: number };
  answer: string;
  resetKey: string;
  onCommit: (attempt: string) => void;
  onFeel: (feel: "hop" | "slide") => void;
  kind?: "block" | "bolt" | "plank";
}) {
  const left = Math.max(1, draw?.a ?? 3);
  const right = Math.max(0, draw?.b ?? 1);
  const [picked, setPicked] = useState<string | null>(null);
  const [feel, setFeel] = useState<"" | "snap" | "slide">("");
  const locked = useRef(false);
  useEffect(() => {
    setPicked(null);
    setFeel("");
    locked.current = false;
  }, [resetKey]);
  function tap(value: string) {
    if (locked.current) {
      return;
    }
    locked.current = true;
    setPicked(value);
    if (value === answer) {
      setFeel("snap");
      onFeel("hop");
      window.setTimeout(() => onCommit(value), 380);
      return;
    }
    setFeel("slide");
    onFeel("slide");
    window.setTimeout(() => onCommit(value), 500);
  }
  return (
    <div className={`gk-compare ${feel === "snap" ? "is-snap" : feel === "slide" ? "is-slide" : ""}`} data-action="compare-piles">
      <button type="button" className={picked === String(left) ? `is-picked ${feel}` : ""} data-pile="left" data-choice={String(left)} onClick={() => tap(String(left))}>
        <span className="gk-numeral">
          <b>{left}</b>
          <NumeralDots count={left} />
        </span>
        <span className="gk-pile">
          {Array.from({ length: Math.min(12, left) }, (_, index) => (
            <Piece key={index} kind={kind} />
          ))}
        </span>
      </button>
      <img className="gk-compare-goat" src={art("goat-idle.png")} alt="" />
      <button type="button" className={picked === String(right) ? `is-picked ${feel}` : ""} data-pile="right" data-choice={String(right)} onClick={() => tap(String(right))}>
        <span className="gk-numeral">
          <b>{right}</b>
          <NumeralDots count={right} />
        </span>
        <span className="gk-pile">
          {Array.from({ length: Math.min(12, right) }, (_, index) => (
            <Piece key={index} kind={kind} />
          ))}
        </span>
      </button>
    </div>
  );
}

function Shape({ name }: { name: string }) {
  if (name === "square") {
    return (
      <span className="gk-shape is-square">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <rect x="3" y="3" width="22" height="22" rx="3" fill="#c47a3a" />
        </svg>
      </span>
    );
  }
  if (name === "circle") {
    return (
      <span className="gk-shape is-circle">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="11" fill="#2e7fb0" />
        </svg>
      </span>
    );
  }
  return (
    <span className="gk-shape is-triangle">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <path d="M14 3 L26 25 H2 Z" fill="#3c7a2b" />
      </svg>
    </span>
  );
}

export function PatternGapPad({
  answer,
  choices,
  resetKey,
  onCommit,
  onFeel,
}: {
  answer: string;
  choices?: ChoiceOption[];
  resetKey: string;
  onCommit: (attempt: string) => void;
  onFeel: (feel: "hop" | "slide") => void;
}) {
  const options = choices && choices.length > 0 ? choices.map((option) => option.value) : ["triangle", "square", "circle"];
  const [picked, setPicked] = useState<string | null>(null);
  const [feel, setFeel] = useState<"" | "snap" | "slide">("");
  const locked = useRef(false);
  useEffect(() => {
    setPicked(null);
    setFeel("");
    locked.current = false;
  }, [resetKey]);
  function tap(value: string) {
    if (locked.current) {
      return;
    }
    locked.current = true;
    setPicked(value);
    if (value === answer) {
      setFeel("snap");
      onFeel("hop");
      window.setTimeout(() => onCommit(value), 380);
      return;
    }
    setFeel("slide");
    onFeel("slide");
    window.setTimeout(() => {
      setPicked(null);
      setFeel("");
      locked.current = false;
      onCommit(value);
    }, 500);
  }
  return (
    <div className={`gk-pattern ${feel === "snap" ? "is-snap" : feel === "slide" ? "is-slide" : ""}`} data-action="pattern-gap">
      <div className="gk-pattern-row">
        <Shape name="triangle" />
        <Shape name="square" />
        <Shape name="triangle" />
        <span className="gk-pattern-gap" data-gap="1">
          {picked && feel === "snap" ? <Shape name={picked} /> : null}
        </span>
      </div>
      <div className="gk-pattern-picks">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            data-choice={value}
            className={picked === value ? (feel === "slide" ? "is-slide" : "is-snap") : ""}
            onClick={() => tap(value)}
          >
            <Shape name={value} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function GoatHop({ hop }: { hop?: boolean }) {
  return (
    <div className={hop ? "gk-goat-line is-hop" : "gk-goat-line"} data-goat-hop={hop ? "1" : undefined}>
      <img src={art("goat-idle.png")} alt="" />
      <p className="gk-note gk-parent-words">The goat waits on the bank.</p>
    </div>
  );
}
