"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import type { HydratedEntity } from "../lib/field-guide";

type RelationOrbitProps = {
  entity: HydratedEntity;
  compareSlug: string | null;
  onCompare: (slug: string) => void;
  onSelect: (slug: string) => void;
};

export function RelationOrbit({
  entity,
  compareSlug,
  onCompare,
  onSelect,
}: Readonly<RelationOrbitProps>) {
  const nodes = entity.relationTargets.slice(0, 6).map((relation, index, allNodes) => {
    const angle = (Math.PI * 2 * index) / Math.max(allNodes.length, 1) - Math.PI / 2;
    const radius = 164 + ((index % 2) * 26);
    const svgRadius = 118 + ((index % 2) * 24);

    return {
      relation,
      index,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      svgX: 240 + Math.cos(angle) * svgRadius,
      svgY: 240 + Math.sin(angle) * svgRadius,
    };
  });

  return (
    <div className="relation-orbit">
      <svg className="relation-web" viewBox="0 0 480 480" aria-hidden="true">
        <circle className="relation-ring relation-ring-outer" cx="240" cy="240" r="146" />
        <circle className="relation-ring relation-ring-mid" cx="240" cy="240" r="118" />
        <circle className="relation-ring relation-ring-inner" cx="240" cy="240" r="82" />
        {nodes.map((node) => (
          <g key={`link-${entity.slug}-${node.relation.targetSlug}`}>
            <line className="relation-link" x1="240" x2={node.svgX} y1="240" y2={node.svgY} />
            <circle className="relation-link-dot" cx={node.svgX} cy={node.svgY} r="4.5" />
          </g>
        ))}
      </svg>

      <motion.div
        className="relation-core"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <span className="relation-core-label">{entity.entityType}</span>
        <strong>{entity.displayName}</strong>
        <small>{entity.era}</small>
      </motion.div>

      {nodes.map((node) => {
        const isCompared = compareSlug === node.relation.target?.slug;

        return (
          <motion.div
            className="orbit-node-slot"
            key={`${entity.slug}-${node.relation.targetSlug}`}
            initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
            animate={{ opacity: 1, scale: 1, x: node.x, y: node.y }}
            transition={{
              duration: 0.48,
              ease: "easeOut",
              delay: 0.08 * node.index,
            }}
          >
            <button
              className={clsx("orbit-node", isCompared && "is-compared")}
              type="button"
              onClick={() => node.relation.target && onSelect(node.relation.target.slug)}
            >
              <span>{node.relation.typeLabel}</span>
              <strong>{node.relation.target?.displayName ?? node.relation.targetSlug}</strong>
            </button>
            {node.relation.target ? (
              <button
                aria-label={`Dock ${node.relation.target.displayName} in compare panel`}
                className={clsx("orbit-pin", isCompared && "is-compared")}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCompare(node.relation.target!.slug);
                }}
              >
                +
              </button>
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}
