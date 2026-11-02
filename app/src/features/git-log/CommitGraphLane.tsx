import React from 'react';
import type { GitCommitItem } from '../../store/types';

const LANE_COLORS = [
  '#38bdf8', // sky-400
  '#34d399', // emerald-400
  '#a78bfa', // violet-400
  '#fbbf24', // amber-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
];

export interface CommitGraphRow {
  hash: string;
  nodeLane: number;
  nodeColor: string;
  isMerge: boolean;
  lanesBefore: Array<string | null>;
  lanesAfter: Array<string | null>;
  mergeInLanes: number[];
  branchOutLanes: number[];
  maxLanes: number;
}

export function computeCommitGraphRows(commits: GitCommitItem[], maxAllowedLanes = 5): CommitGraphRow[] {
  const rows: CommitGraphRow[] = [];
  let activeLanes: Array<string | null> = [];

  for (const commit of commits) {
    const hash = commit.hash;
    const parents = commit.parents || [];
    const lanesBefore = [...activeLanes];

    // Find lane expecting this commit hash
    let nodeLane = activeLanes.indexOf(hash);
    if (nodeLane === -1) {
      nodeLane = activeLanes.indexOf(null);
      if (nodeLane === -1) {
        if (activeLanes.length < maxAllowedLanes) {
          nodeLane = activeLanes.length;
          activeLanes.push(hash);
        } else {
          nodeLane = maxAllowedLanes - 1;
          activeLanes[nodeLane] = hash;
        }
      } else {
        activeLanes[nodeLane] = hash;
      }
    }

    // Any other duplicate lanes pointing to this same hash collapse into nodeLane
    const branchOutLanes: number[] = [];
    for (let i = 0; i < activeLanes.length; i++) {
      if (i !== nodeLane && activeLanes[i] === hash) {
        branchOutLanes.push(i);
        activeLanes[i] = null;
      }
    }

    const mergeInLanes: number[] = [];
    const nextLanes = [...activeLanes];

    if (parents.length === 0) {
      nextLanes[nodeLane] = null;
    } else {
      // First parent continues on nodeLane
      nextLanes[nodeLane] = parents[0];
      // Additional parents (merge commit)
      for (let pIdx = 1; pIdx < parents.length; pIdx++) {
        const pHash = parents[pIdx];
        let pLane = nextLanes.indexOf(pHash);
        if (pLane === -1) {
          const emptyIdx = nextLanes.indexOf(null);
          if (emptyIdx !== -1) {
            pLane = emptyIdx;
            nextLanes[pLane] = pHash;
          } else if (nextLanes.length < maxAllowedLanes) {
            pLane = nextLanes.length;
            nextLanes.push(pHash);
          } else {
            pLane = maxAllowedLanes - 1;
          }
        }
        mergeInLanes.push(pLane);
      }
    }

    // Trim trailing null lanes
    while (nextLanes.length > 0 && nextLanes[nextLanes.length - 1] === null) {
      nextLanes.pop();
    }

    const maxLanes = Math.max(1, lanesBefore.length, nextLanes.length, nodeLane + 1);
    rows.push({
      hash,
      nodeLane,
      nodeColor: LANE_COLORS[nodeLane % LANE_COLORS.length],
      isMerge: parents.length > 1,
      lanesBefore,
      lanesAfter: [...nextLanes],
      mergeInLanes,
      branchOutLanes,
      maxLanes,
    });

    activeLanes = nextLanes;
  }

  return rows;
}

export const CommitGraphLane: React.FC<{ row: CommitGraphRow }> = React.memo(({ row }) => {
  const laneWidth = 12;
  const width = Math.min(5, Math.max(2, row.maxLanes)) * laneWidth + 4;
  const height = 38;
  const midY = height / 2;
  const cx = row.nodeLane * laneWidth + 8;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 select-none overflow-visible -my-1"
    >
      {/* Top half pass-through lines */}
      {row.lanesBefore.map((h, idx) => {
        if (!h) return null;
        const x = idx * laneWidth + 8;
        const color = LANE_COLORS[idx % LANE_COLORS.length];
        if (row.branchOutLanes.includes(idx)) {
          return (
            <path
              key={`b-${idx}`}
              d={`M ${x} 0 C ${x} ${midY * 0.6}, ${cx} ${midY * 0.4}, ${cx} ${midY}`}
              stroke={color}
              strokeWidth={1.6}
              fill="none"
            />
          );
        }
        return (
          <line
            key={`t-${idx}`}
            x1={x}
            y1={0}
            x2={x}
            y2={midY}
            stroke={color}
            strokeWidth={1.6}
          />
        );
      })}

      {/* Bottom half pass-through lines */}
      {row.lanesAfter.map((h, idx) => {
        if (!h) return null;
        const x = idx * laneWidth + 8;
        const color = LANE_COLORS[idx % LANE_COLORS.length];
        return (
          <line
            key={`a-${idx}`}
            x1={x}
            y1={midY}
            x2={x}
            y2={height}
            stroke={color}
            strokeWidth={1.6}
          />
        );
      })}

      {/* Merge curves */}
      {row.mergeInLanes.map((mLane, i) => {
        const mx = mLane * laneWidth + 8;
        const color = LANE_COLORS[mLane % LANE_COLORS.length];
        return (
          <path
            key={`m-${i}`}
            d={`M ${cx} ${midY} C ${cx} ${midY + 10}, ${mx} ${midY + 6}, ${mx} ${height}`}
            stroke={color}
            strokeWidth={1.6}
            fill="none"
          />
        );
      })}

      {/* Commit node circle */}
      <circle
        cx={cx}
        cy={midY}
        r={row.isMerge ? 4 : 3.2}
        fill={row.isMerge ? '#18181b' : row.nodeColor}
        stroke={row.nodeColor}
        strokeWidth={row.isMerge ? 2 : 1.5}
      />
    </svg>
  );
});
CommitGraphLane.displayName = 'CommitGraphLane';
