"use client";

import { motion, useReducedMotion } from "framer-motion";

const stars = Array.from({ length: 42 }, (_, index) => ({
  id: `star-${index}`,
  top: `${6 + ((index * 17) % 82)}%`,
  left: `${4 + ((index * 23) % 92)}%`,
  size: 2 + (index % 4),
  duration: 6 + (index % 7),
  delay: (index % 9) * 0.45,
}));

export function ArchiveBackdrop() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="archive-backdrop" aria-hidden="true">
      <div className="archive-nebula archive-nebula-one" />
      <div className="archive-nebula archive-nebula-two" />
      <div className="archive-nebula archive-nebula-three" />
      <div className="archive-grid-haze" />
      {stars.map((star) => (
        <motion.span
          className="archive-star"
          key={star.id}
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
          }}
          animate={
            reducedMotion
              ? undefined
              : {
                  opacity: [0.25, 0.95, 0.35],
                  scale: [1, 1.55, 1],
                }
          }
          transition={{
            duration: star.duration,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: star.delay,
          }}
        />
      ))}
    </div>
  );
}
