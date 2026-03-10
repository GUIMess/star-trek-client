"use client";

import { getHydratedEntity, type HydratedEntity } from "../lib/field-guide";

type CartographyPlateProps = {
  entity: HydratedEntity;
};

export function CartographyPlate({ entity }: CartographyPlateProps) {
  if (!entity.cartography) {
    return (
      <article className="cartography-plate cartography-plate-empty">
        <div className="cartography-copy">
          <p className="eyebrow">Cartography</p>
          <strong>No mapped sector plate loaded.</strong>
          <p>This dossier still links through timeline, source trail, and relation records.</p>
        </div>
      </article>
    );
  }

  const relationNodes = entity.relationTargets
    .map((relation) => ({
      relation,
      target: relation.target ? getHydratedEntity(relation.target.slug) : null,
    }))
    .filter((entry) => entry.target?.cartography)
    .slice(0, 5)
    .map((entry) => ({
      id: entry.target!.slug,
      label: entry.target!.displayName,
      relation: entry.relation.typeLabel,
      x: entry.target!.cartography!.x,
      y: entry.target!.cartography!.y,
    }));

  return (
    <article className="cartography-plate">
      <div className="cartography-stage" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {relationNodes.map((node) => (
            <line
              className="cartography-line"
              key={`line-${node.id}`}
              x1={entity.cartography!.x}
              y1={entity.cartography!.y}
              x2={node.x}
              y2={node.y}
            />
          ))}
          {relationNodes.map((node) => (
            <g className="cartography-node cartography-node-secondary" key={node.id} transform={`translate(${node.x} ${node.y})`}>
              <circle r="2.3" />
            </g>
          ))}
          <g className="cartography-node cartography-node-active" transform={`translate(${entity.cartography.x} ${entity.cartography.y})`}>
            <circle r="3.1" />
          </g>
        </svg>
      </div>

      <div className="cartography-copy">
        <div className="cartography-head">
          <div>
            <p className="eyebrow">Cartography</p>
            <strong>{entity.cartography.quadrant}</strong>
          </div>
          <span>{entity.cartography.gridLabel}</span>
        </div>
        <p>{entity.cartography.sector}</p>
        <small>{entity.cartography.rangeLabel}</small>
      </div>

      <div className="cartography-node-list">
        {relationNodes.length ? (
          relationNodes.map((node) => (
            <article className="cartography-node-row" key={`row-${node.id}`}>
              <span>{node.relation}</span>
              <strong>{node.label}</strong>
            </article>
          ))
        ) : (
          <article className="cartography-node-row">
            <span>Archive note</span>
            <strong>No adjacent mapped nodes loaded.</strong>
          </article>
        )}
      </div>
    </article>
  );
}
