"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  GROW_END,
  LOOP_END,
  PlantScene,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type PlantSceneProps,
} from "@/remotion/PlantScene";

const query = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const m = window.matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

export function PlantPlayer(props: PlantSceneProps) {
  const ref = useRef<PlayerRef>(null);
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );

  // Grow once from frame 0, then loop only the idle sway (GROW_END..LOOP_END).
  useEffect(() => {
    const player = ref.current;
    if (!player || reduced) return;
    const onEnded = () => {
      player.seekTo(GROW_END);
      player.play();
    };
    player.addEventListener("ended", onEnded);
    return () => player.removeEventListener("ended", onEnded);
  }, [reduced]);

  return (
    <div className="overflow-hidden rounded-3xl border border-ink/10 shadow-sm">
      <Player
        ref={ref}
        component={PlantScene}
        inputProps={props}
        durationInFrames={LOOP_END}
        fps={30}
        compositionWidth={SCENE_WIDTH}
        compositionHeight={SCENE_HEIGHT}
        // Reduced motion: a still, fully grown plant.
        autoPlay={!reduced}
        initialFrame={reduced ? GROW_END : 0}
        controls={false}
        style={{ width: "100%", aspectRatio: `${SCENE_WIDTH} / ${SCENE_HEIGHT}` }}
      />
    </div>
  );
}
