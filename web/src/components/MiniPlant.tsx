import { GROW_END, PlantArt, SCENE_HEIGHT, SCENE_WIDTH } from "@/remotion/PlantScene";
import type { Growth } from "@/lib/score";

/** A still, fully grown plant for lists. No animation, so it is cheap to repeat. */
export function MiniPlant({ growth, className = "" }: { growth: Growth; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-lg ${className}`}
      style={{ aspectRatio: `${SCENE_WIDTH} / ${SCENE_HEIGHT}` }}
    >
      <PlantArt
        trade={growth.trade}
        borrow={growth.borrow}
        save={growth.save}
        roots={growth.roots}
        wilt={growth.wilt}
        score={growth.score}
        grow={1}
        frame={GROW_END}
      />
    </div>
  );
}
