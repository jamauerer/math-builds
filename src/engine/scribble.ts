export type ScribblePoint = { x: number; y: number };

export type ScribbleStroke = {
  color: string;
  size: number;
  eraser: boolean;
  points: ScribblePoint[];
};

export type Scribble = {
  strokes: ScribbleStroke[];
};

export function emptyScribble(): Scribble {
  return { strokes: [] };
}

export function beginStroke(
  scribble: Scribble,
  stroke: { color: string; size: number; eraser: boolean; point: ScribblePoint },
): Scribble {
  return {
    strokes: [
      ...scribble.strokes,
      { color: stroke.color, size: stroke.size, eraser: stroke.eraser, points: [stroke.point] },
    ],
  };
}

export function extendStroke(scribble: Scribble, point: ScribblePoint): Scribble {
  if (scribble.strokes.length === 0) {
    return scribble;
  }
  const strokes = scribble.strokes.slice();
  const last = strokes[strokes.length - 1];
  strokes[strokes.length - 1] = { ...last, points: [...last.points, point] };
  return { strokes };
}

export function undoStroke(scribble: Scribble): Scribble {
  return { strokes: scribble.strokes.slice(0, -1) };
}

export function clearScribble(): Scribble {
  return emptyScribble();
}

/** A new question starts blank. The same question keeps its strokes, including after a resume. */
export function scribbleForQuestion(questionKey: string, previousKey: string, scribble: Scribble): Scribble {
  if (questionKey !== previousKey) {
    return emptyScribble();
  }
  return scribble;
}

export function canvasPixelSize(cssWidth: number, cssHeight: number, dpr: number): { width: number; height: number } {
  const ratio = dpr > 0 ? dpr : 1;
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
  };
}
