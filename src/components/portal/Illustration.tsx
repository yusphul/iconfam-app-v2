import type { CaseType } from "@/lib/types";

// Flat vector scenes for the client portal: one per kind of verification, and a
// welcome scene for the empty state. Plain SVG shapes in the brand palette, so
// they stay sharp at any size and add nothing to the download.
//
// Every scene is drawn on an 800 x 320 canvas with the subject on the right
// (x 470 to 790, sitting on the ground at y 268). The svg is anchored to the
// bottom right and cropped to fit, so a wide banner, a short card and an 80px
// square thumbnail all keep the subject in view and leave the left side calm
// for text.

export type SceneKind = CaseType | "welcome";

const SKY = "#1C3F5E";
const CLOUD = "#2A5578";
const HILL_FAR = "#17354F";
const HILL_NEAR = "#122B43";
const GROUND = "#0F2438";
const PAPER = "#F5F7FA";
const MIST = "#E6EBF0";
const STEEL = "#C9D3DC";
const STAMP = "#E8622C";
const STAMP_DARK = "#C94F1D";
const VERIFIED = "#3DBD8C";
const LEAF = "#2E9E75";
const SUN = "#F2B544";
const SOIL = "#C9A66B";

const LABELS: Record<SceneKind, string> = {
  property_purchase: "Illustration of a surveyed plot of land with boundary beacons and a surveyor's instrument",
  ground_up_build: "Illustration of a house under construction with a crane",
  farm_oversight: "Illustration of a farm with crop rows, a barn and a palm tree",
  status_verification: "Illustration of a title deed and survey plan with a verified seal",
  welcome: "Illustration of a finished home with a verified shield",
};

export default function Illustration({
  kind,
  className,
  label,
  calm,
}: {
  kind: SceneKind;
  className?: string;
  /** Pass true to describe the scene to screen readers; decorative by default. */
  label?: boolean;
  /** For banners with text and badges on top: a small sun and no floating badges. */
  calm?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 800 320"
      preserveAspectRatio="xMaxYMax slice"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label ? LABELS[kind] : undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <Backdrop calm={calm} />
      {kind === "property_purchase" && <Land calm={calm} />}
      {kind === "ground_up_build" && <Build calm={calm} />}
      {kind === "farm_oversight" && <Farm calm={calm} />}
      {kind === "status_verification" && <Documents />}
      {kind === "welcome" && <Welcome calm={calm} />}
    </svg>
  );
}

function Backdrop({ calm }: { calm?: boolean }) {
  return (
    <g>
      <rect width="800" height="320" fill={SKY} />
      {calm ? <circle cx="450" cy="44" r="22" fill={STAMP} /> : <circle cx="430" cy="96" r="30" fill={STAMP} />}
      {/* clouds */}
      <g fill={CLOUD}>
        <rect x="70" y="70" width="150" height="22" rx="11" />
        <rect x="104" y="52" width="80" height="22" rx="11" />
        <rect x="250" y="130" width="120" height="18" rx="9" />
        <rect x="560" y="48" width="110" height="16" rx="8" />
      </g>
      <path d="M0 232 Q120 176 262 216 T520 208 T800 214 V320 H0Z" fill={HILL_FAR} />
      <path d="M0 262 Q150 228 320 256 T640 250 T800 260 V320 H0Z" fill={HILL_NEAR} />
      <rect y="268" width="800" height="52" fill={GROUND} />
    </g>
  );
}

function Shield({ x, y, size = 52 }: { x: number; y: number; size?: number }) {
  const s = size / 52;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M26 0 L50 9 V28 C50 42 39 50 26 56 C13 50 2 42 2 28 V9 Z" fill={VERIFIED} />
      <path d="M26 6 L44 13 V28 C44 38 36 44 26 49 Z" fill="#35A97D" />
      <path d="M15 27 L23 35 L38 19" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function Palm({ x, y, height = 110, lean = 8 }: { x: number; y: number; height?: number; lean?: number }) {
  const top = { x: x + lean, y: y - height };
  const fronds = [-20, 25, 70, 110, 155, 200];
  return (
    <g>
      <path d={`M${x} ${y} Q${x + lean * 1.8} ${y - height * 0.5} ${top.x} ${top.y}`} fill="none" stroke="#8A5A3A" strokeWidth="8" strokeLinecap="round" />
      <g transform={`translate(${top.x} ${top.y})`}>
        {fronds.map((a) => (
          <path key={a} d="M0 0 Q26 -20 58 -2 Q30 -4 0 0Z" fill={LEAF} transform={`rotate(${a})`} />
        ))}
        <circle r="5" fill="#8A5A3A" />
      </g>
    </g>
  );
}

function Tree({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 3} y={y - 26} width="6" height="26" fill="#8A5A3A" />
      <circle cx={x} cy={y - 36} r="19" fill={LEAF} />
      <circle cx={x + 11} cy={y - 28} r="12" fill="#26866A" />
    </g>
  );
}

/** Surveyed plot: boundary beacons, a theodolite on a tripod, a verified shield. */
function Land({ calm }: { calm?: boolean }) {
  const corners: [number, number][] = [
    [490, 268],
    [690, 252],
    [775, 282],
    [545, 306],
  ];
  return (
    <g>
      <Tree x={500} y={252} />
      <polygon points={corners.map((c) => c.join(",")).join(" ")} fill={SOIL} />
      <polygon points={corners.map((c) => c.join(",")).join(" ")} fill="none" stroke={PAPER} strokeWidth="3" strokeDasharray="9 7" strokeLinejoin="round" />
      {/* soil rows */}
      <g stroke="#B8955A" strokeWidth="3" strokeLinecap="round">
        <path d="M540 282 L690 268" />
        <path d="M560 294 L735 280" />
      </g>
      {corners.map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <rect x={cx - 3} y={cy - 22} width="6" height="22" fill={PAPER} />
          <rect x={cx - 5} y={cy - 27} width="10" height="7" rx="2" fill={STAMP} />
        </g>
      ))}
      {/* theodolite */}
      <g stroke={STEEL} strokeWidth="5" strokeLinecap="round">
        <path d="M640 196 L606 290" />
        <path d="M640 196 L640 297" />
        <path d="M640 196 L674 290" />
      </g>
      <rect x="626" y="190" width="28" height="9" rx="3" fill={STEEL} />
      <rect x="624" y="152" width="32" height="40" rx="7" fill={PAPER} />
      <rect x="612" y="140" width="56" height="16" rx="8" fill={STAMP} />
      <circle cx="668" cy="148" r="7" fill={SKY} />
      <circle cx="668" cy="148" r="3" fill={PAPER} />
      <rect x="633" y="166" width="14" height="6" rx="3" fill={SKY} />
      {!calm && <Shield x={716} y={112} size={50} />}
    </g>
  );
}

/** A house going up: slab, columns, a first floor, scaffold and a tower crane. */
function Build({ calm }: { calm?: boolean }) {
  return (
    <g>
      {/* block pile */}
      <g fill="#D9704A">
        <rect x="468" y="276" width="26" height="10" rx="2" />
        <rect x="474" y="266" width="26" height="10" rx="2" />
        <rect x="468" y="286" width="26" height="10" rx="2" />
      </g>
      {/* slab and ground floor */}
      <rect x="506" y="276" width="250" height="14" fill={STEEL} />
      <rect x="514" y="204" width="234" height="72" fill={MIST} />
      <rect x="532" y="226" width="30" height="50" fill={SKY} />
      <g fill={SKY}>
        <rect x="590" y="224" width="32" height="28" rx="3" />
        <rect x="642" y="224" width="32" height="28" rx="3" />
        <rect x="694" y="224" width="32" height="28" rx="3" />
      </g>
      {/* first floor slab */}
      <rect x="508" y="196" width="246" height="10" fill={STEEL} />
      {/* columns going up, with rebar on top */}
      <g fill="#B3C0CC">
        <rect x="514" y="136" width="10" height="60" />
        <rect x="590" y="136" width="10" height="60" />
        <rect x="666" y="136" width="10" height="60" />
        <rect x="738" y="136" width="10" height="60" />
      </g>
      <g fill={STAMP_DARK}>
        <rect x="517" y="118" width="4" height="18" />
        <rect x="593" y="118" width="4" height="18" />
        <rect x="669" y="118" width="4" height="18" />
        <rect x="741" y="118" width="4" height="18" />
      </g>
      {/* half-built wall */}
      <rect x="524" y="164" width="66" height="32" fill={MIST} />
      <g stroke={STEEL} strokeWidth="2">
        <path d="M524 174 H590" />
        <path d="M524 185 H590" />
        <path d="M557 164 V174 M540 174 V185 M574 174 V185 M557 185 V196" />
      </g>
      {/* scaffold on the right */}
      <g stroke={SUN} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M756 136 V290 M776 136 V290" />
        <path d="M756 170 H776 M756 204 H776 M756 238 H776" />
        <path d="M756 170 L776 204 M756 204 L776 238 M756 238 L776 272" />
      </g>
      {/* tower crane */}
      <rect x="784" y="58" width="9" height="232" fill={SUN} />
      <rect x="590" y="58" width="210" height="9" fill={SUN} />
      <rect x="772" y="46" width="22" height="14" rx="3" fill={STAMP} />
      <path d="M690 67 V104" stroke={PAPER} strokeWidth="2" />
      <rect x="682" y="104" width="16" height="10" rx="2" fill={STAMP} />
      <rect x="664" y="114" width="52" height="8" rx="2" fill={STEEL} />
      {!calm && <Shield x={500} y={78} size={44} />}
    </g>
  );
}

/** A working farm: crop rows, barn, palm, and a tablet showing a green tick. */
function Farm({ calm }: { calm?: boolean }) {
  const stripes = Array.from({ length: 8 }, (_, i) => i);
  return (
    <g>
      <polygon points="470,246 800,246 800,320 330,320" fill="#3C8D5A" />
      {stripes.map((i) => {
        const a = 480 + i * 46;
        const b = 340 + i * 108;
        return <polygon key={i} points={`${a},246 ${a + 22},246 ${b + 52},320 ${b},320`} fill="#2F7A4B" />;
      })}
      {/* barn */}
      <rect x="548" y="200" width="92" height="50" fill={STAMP} />
      <polygon points="538,202 594,160 650,202" fill={STAMP_DARK} />
      <rect x="582" y="218" width="24" height="32" fill={PAPER} />
      <path d="M582 218 L606 250 M606 218 L582 250" stroke={STEEL} strokeWidth="2" />
      <rect x="587" y="188" width="14" height="10" rx="2" fill={PAPER} />
      {/* palm */}
      <Palm x={706} y={252} height={118} lean={10} />
      {/* tablet */}
      {!calm && (
      <g transform="translate(482 88)">
        <rect width="76" height="54" rx="7" fill={PAPER} />
        <rect x="6" y="6" width="64" height="42" rx="3" fill={SKY} />
        <rect x="14" y="30" width="8" height="12" fill={VERIFIED} />
        <rect x="27" y="24" width="8" height="18" fill={VERIFIED} />
        <rect x="40" y="16" width="8" height="26" fill={VERIFIED} />
        <circle cx="58" cy="16" r="7" fill={VERIFIED} />
        <path d="M54.5 16 L57 18.5 L62 13.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      )}
    </g>
  );
}

/** Title deed and survey plan, a magnifier and a confirmed seal. */
function Documents() {
  return (
    <g>
      {/* title deed */}
      <g transform="rotate(-6 590 190)">
        <rect x="514" y="84" width="150" height="196" rx="8" fill={PAPER} />
        <rect x="514" y="84" width="150" height="30" rx="8" fill={STAMP} />
        <rect x="514" y="100" width="150" height="14" fill={STAMP} />
        <g fill={STEEL}>
          <rect x="532" y="130" width="112" height="8" rx="4" />
          <rect x="532" y="150" width="96" height="8" rx="4" />
          <rect x="532" y="170" width="112" height="8" rx="4" />
          <rect x="532" y="190" width="84" height="8" rx="4" />
          <rect x="532" y="210" width="104" height="8" rx="4" />
        </g>
        <path d="M534 252 q10 -14 20 0 t20 0 t20 0" fill="none" stroke="#7B8794" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* survey plan */}
      <g transform="rotate(5 690 176)">
        <rect x="610" y="72" width="150" height="196" rx="8" fill={MIST} />
        <polygon points="640,128 716,112 736,176 654,200" fill="#D8E8DF" stroke={LEAF} strokeWidth="3" strokeDasharray="7 5" strokeLinejoin="round" />
        <g fill={STAMP}>
          <circle cx="640" cy="128" r="5" />
          <circle cx="716" cy="112" r="5" />
          <circle cx="736" cy="176" r="5" />
          <circle cx="654" cy="200" r="5" />
        </g>
        <g fill={STEEL}>
          <rect x="628" y="222" width="70" height="7" rx="3.5" />
          <rect x="628" y="238" width="104" height="7" rx="3.5" />
        </g>
      </g>
      {/* seal */}
      <g transform="translate(724 236)">
        <circle r="34" fill={STAMP} />
        <circle r="27" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="4 4" />
        <path d="M-12 1 L-3 10 L13 -8" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* magnifier */}
      <g>
        <circle cx="560" cy="238" r="27" fill="#CFE6F5" fillOpacity="0.55" stroke={SUN} strokeWidth="8" />
        <path d="M541 258 L516 284" stroke={SUN} strokeWidth="11" strokeLinecap="round" />
      </g>
    </g>
  );
}

/** Empty state: a finished home, palms, and the verified shield. */
function Welcome({ calm }: { calm?: boolean }) {
  return (
    <g>
      <Palm x={500} y={262} height={96} lean={-8} />
      <Palm x={778} y={262} height={120} lean={10} />
      {/* path */}
      <polygon points="596,320 620,266 650,266 680,320" fill={SOIL} />
      {/* house */}
      <rect x="544" y="176" width="156" height="94" fill={PAPER} />
      <polygon points="526,180 622,112 718,180" fill={STAMP} />
      <polygon points="526,180 622,112 622,124 540,184" fill={STAMP_DARK} />
      <rect x="664" y="124" width="20" height="38" fill={STEEL} />
      <rect x="606" y="212" width="32" height="58" rx="2" fill={SKY} />
      <circle cx="632" cy="242" r="2.5" fill={SUN} />
      <g fill={SKY}>
        <rect x="560" y="198" width="32" height="30" rx="3" />
        <rect x="652" y="198" width="32" height="30" rx="3" />
      </g>
      <g stroke={PAPER} strokeWidth="3">
        <path d="M576 198 V228 M560 213 H592" />
        <path d="M668 198 V228 M652 213 H684" />
      </g>
      {!calm && <Shield x={716} y={60} size={58} />}
    </g>
  );
}
