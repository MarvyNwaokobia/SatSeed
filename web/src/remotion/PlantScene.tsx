import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type PlantSceneProps = {
  /** Each 0..1 */
  trade: number;
  borrow: number;
  save: number;
  roots: number;
  /** 0 thriving .. 1 wilted */
  wilt: number;
  /** 0..100 */
  score: number;
};

export const SCENE_WIDTH = 800;
export const SCENE_HEIGHT = 700;
/** Frames 0..GROW_END play the growth; the loop range then repeats the idle sway only. */
export const GROW_END = 90;
export const LOOP_END = 240;
const SWAY_PERIOD = LOOP_END - GROW_END;

const GROUND_Y = 540;
const CX = SCENE_WIDTH / 2;

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const LEAF_HEALTHY: [number, number, number] = [74, 140, 98];
const LEAF_WILTED: [number, number, number] = [160, 130, 70];
const TRUNK: [number, number, number] = [92, 64, 44];

type BranchSpec = {
  value: number;
  side: -1 | 0 | 1;
  /** Fraction of trunk height where it attaches */
  at: number;
  fruit: string;
};

function Branch({
  spec,
  trunkTopY,
  grow,
  wilt,
  frame,
}: {
  spec: BranchSpec;
  trunkTopY: number;
  grow: number;
  wilt: number;
  frame: number;
}) {
  if (spec.value <= 0.01) return null;

  const baseY = GROUND_Y - (GROUND_Y - trunkTopY) * spec.at;
  const len = (50 + 150 * spec.value) * grow;
  const droop = wilt * 40;
  const ex = CX + spec.side * len * 0.9;
  const ey = (spec.side === 0 ? baseY - len : baseY - len * 0.55) + droop;
  const mx = CX + spec.side * len * 0.45;
  const my = baseY - len * 0.15;
  const d = `M ${CX} ${baseY} Q ${mx} ${my} ${ex} ${ey}`;

  const leafCount = Math.max(2, Math.round(spec.value * 9));
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const t = (i + 1) / (leafCount + 1);
    // point on the quadratic curve
    const x = (1 - t) ** 2 * CX + 2 * (1 - t) * t * mx + t * t * ex;
    const y = (1 - t) ** 2 * baseY + 2 * (1 - t) * t * my + t * t * ey;
    const flip = i % 2 === 0 ? -1 : 1;
    const angle = flip * (35 + 20 * (1 - wilt)) + wilt * 50 * (spec.side || flip);
    const size = (10 + 10 * spec.value) * (0.6 + 0.4 * t);
    const delay = i / (leafCount + 2);
    const appear = Math.min(Math.max((grow - delay * 0.6) / 0.4, 0), 1);
    const flutter = Math.sin(((frame - GROW_END) / SWAY_PERIOD) * Math.PI * 2 + i) * 3 * (1 - wilt);
    return { x, y, angle: angle + flutter, size: size * appear, key: i };
  });

  const showFruit = spec.value > 0.55 && wilt < 0.6;

  return (
    <g>
      <path d={d} fill="none" stroke={mix(TRUNK, [60, 45, 32], wilt)} strokeWidth={5} strokeLinecap="round" />
      {leaves.map((l) => (
        <ellipse
          key={l.key}
          cx={l.x}
          cy={l.y}
          rx={l.size}
          ry={l.size * 0.5}
          transform={`rotate(${l.angle} ${l.x} ${l.y})`}
          fill={mix(LEAF_HEALTHY, LEAF_WILTED, wilt)}
          opacity={0.95}
        />
      ))}
      {showFruit && <circle cx={ex} cy={ey} r={9 * grow} fill={spec.fruit} stroke="#00000022" />}
    </g>
  );
}

export function PlantScene({ trade, borrow, save, roots, wilt, score }: PlantSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const grow = spring({ frame, fps, config: { damping: 200 }, durationInFrames: GROW_END });
  const sway =
    Math.sin(((frame - GROW_END) / SWAY_PERIOD) * Math.PI * 2) * 1.6 * (1 - wilt * 0.7);

  const overall = Math.min(Math.max(score / 100, 0), 1);
  const trunkHeight = (36 + 300 * Math.sqrt(overall)) * grow;
  const trunkTopY = GROUND_Y - trunkHeight;
  const trunkWidth = 7 + 11 * overall;

  const rootCount = 2 + Math.round(roots * 5);
  const rootGrow = interpolate(grow, [0, 1], [0, 1]);

  const branches: BranchSpec[] = [
    { value: borrow, side: -1, at: 0.55, fruit: "#d9a441" },
    { value: trade, side: 1, at: 0.7, fruit: "#c8553d" },
    { value: save, side: 0, at: 1, fruit: "#e8c35a" },
  ];

  const isSeed = score < 5;
  const bg = mix([246, 240, 224], [232, 224, 204], wilt * 0.5);

  return (
    <svg
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={`Plant at ${Math.round(score)} out of 100`}
    >
      <rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill={bg} />

      {/* soft sun */}
      <circle cx={640} cy={130} r={54} fill="#f2c96b" opacity={0.55 * (1 - wilt * 0.6)} />

      {/* soil */}
      <path
        d={`M 0 ${GROUND_Y} Q 200 ${GROUND_Y - 16} 400 ${GROUND_Y} T 800 ${GROUND_Y} V ${SCENE_HEIGHT} H 0 Z`}
        fill="#7a5a3c"
      />
      <path
        d={`M 0 ${GROUND_Y + 60} Q 200 ${GROUND_Y + 44} 400 ${GROUND_Y + 60} T 800 ${GROUND_Y + 60} V ${SCENE_HEIGHT} H 0 Z`}
        fill="#68492e"
      />

      {/* roots: time in the ecosystem */}
      <g stroke="#a7855d" strokeLinecap="round" fill="none">
        {Array.from({ length: rootCount }, (_, i) => {
          const spread = (i - (rootCount - 1) / 2) / Math.max(rootCount - 1, 1);
          const len = (50 + 90 * roots) * rootGrow;
          const ex = CX + spread * (80 + 160 * roots);
          const ey = GROUND_Y + len;
          return (
            <path
              key={i}
              d={`M ${CX} ${GROUND_Y} Q ${CX + spread * 30} ${GROUND_Y + len * 0.5} ${ex} ${ey}`}
              strokeWidth={4 - Math.abs(spread) * 2}
            />
          );
        })}
      </g>

      {/* plant, swaying from its base */}
      <g transform={`rotate(${sway} ${CX} ${GROUND_Y})`}>
        {isSeed ? (
          <g>
            <ellipse cx={CX} cy={GROUND_Y - 6} rx={12} ry={8} fill="#8a6a3f" />
            <path
              d={`M ${CX} ${GROUND_Y - 10} q 0 ${-18 * grow} 8 ${-26 * grow}`}
              stroke={mix(LEAF_HEALTHY, LEAF_WILTED, wilt)}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
            />
            <ellipse
              cx={CX + 14}
              cy={GROUND_Y - 36 * grow}
              rx={10 * grow}
              ry={5 * grow}
              fill={mix(LEAF_HEALTHY, LEAF_WILTED, wilt)}
              transform={`rotate(-25 ${CX + 14} ${GROUND_Y - 36 * grow})`}
            />
          </g>
        ) : (
          <>
            <path
              d={`M ${CX} ${GROUND_Y + 4} L ${CX} ${trunkTopY}`}
              stroke={mix(TRUNK, [60, 45, 32], wilt)}
              strokeWidth={trunkWidth}
              strokeLinecap="round"
            />
            {branches.map((b, i) => (
              <Branch key={i} spec={b} trunkTopY={trunkTopY} grow={grow} wilt={wilt} frame={frame} />
            ))}
          </>
        )}
      </g>
    </svg>
  );
}
