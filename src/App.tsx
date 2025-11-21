import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Trash2,
  Play,
  Square,
  Diamond,
  Circle,
  GripVertical,
  MousePointer2,
  Layout,
} from "lucide-react";

// --- Types ---
type NodeType = "start" | "process" | "decision" | "end";

interface NodeData {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string; // Added label support for edges
}

interface Selection {
  id: string;
  type: "node" | "edge";
}

// --- Constants ---
const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;
const GRID_SIZE = 20;

// --- Helper Components ---

const NodeIcon = ({
  type,
  className,
}: {
  type: NodeType;
  className?: string;
}) => {
  switch (type) {
    case "start":
      return <Play className={className} />;
    case "process":
      return <Square className={className} />;
    case "decision":
      return <Diamond className={className} />;
    case "end":
      return <Circle className={className} />;
    default:
      return <Square className={className} />;
  }
};

const getNodeStyles = (type: NodeType, isSelected: boolean) => {
  const base =
    "flex items-center justify-center text-sm font-medium transition-all duration-200 border-2 shadow-sm select-none cursor-grab active:cursor-grabbing";
  const selected = isSelected
    ? "ring-2 ring-blue-500 ring-offset-2 border-blue-600 z-10"
    : "border-slate-300 hover:border-slate-400 z-1";

  let shape = "";
  switch (type) {
    case "start":
      shape = "rounded-full bg-green-50 text-green-900";
      break;
    case "process":
      shape = "rounded-lg bg-white text-slate-900";
      break;
    case "decision":
      shape = "rounded-md bg-yellow-50 text-yellow-900 border-yellow-200";
      break;
    case "end":
      shape = "rounded-full bg-red-50 text-red-900";
      break;
  }

  return `${base} ${selected} ${shape}`;
};

export default function App() {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);

  // Unified selection state
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Dragging State
  const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connecting State
  const [connectingSource, setConnectingSource] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Helper: Calculate Paths ---
  const getEdgePath = (
    source: NodeData,
    target: NodeData | { x: number; y: number }
  ) => {
    const sx = source.x + NODE_WIDTH / 2;
    const sy = source.y + NODE_HEIGHT / 2;

    // If target is a node, calculate center. If it's mouse pos, use raw x/y
    const tx = "id" in target ? target.x + NODE_WIDTH / 2 : target.x;
    const ty = "id" in target ? target.y + NODE_HEIGHT / 2 : target.y;

    // const deltaX = Math.abs(tx - sx);
    // If mostly vertical
    if (Math.abs(ty - sy) > Math.abs(tx - sx)) {
      return `M ${sx} ${sy} C ${sx} ${sy + 60}, ${tx} ${ty - 60}, ${tx} ${ty}`;
    }
    // Mostly horizontal
    return `M ${sx} ${sy} C ${sx + 60} ${sy}, ${tx - 60} ${ty}, ${tx} ${ty}`;
  };

  // --- Actions: Adding New Nodes ---
  const handleDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const type = e.dataTransfer.getData("application/reactflow") as NodeType;
    if (!type) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - NODE_WIDTH / 2;
    const y = e.clientY - rect.top - NODE_HEIGHT / 2;

    const newNode: NodeData = {
      id: crypto.randomUUID(),
      type,
      x,
      y,
      label: type.charAt(0).toUpperCase() + type.slice(1),
    };

    setNodes((nds) => [...nds, newNode]);
    setSelection({ id: newNode.id, type: "node" });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // --- Actions: Moving Existing Nodes ---
  const startMovingNode = (
    e: React.MouseEvent,
    id: string,
    x: number,
    y: number
  ) => {
    if (editingId === id) return;
    e.preventDefault();
    e.stopPropagation();

    if (connectingSource) return;

    setIsDraggingNode(id);
    setSelection({ id, type: "node" });

    const rect = canvasRef.current!.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - x,
      y: e.clientY - rect.top - y,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;

      setMousePos({ x: rawX, y: rawY });

      if (isDraggingNode) {
        let newX = rawX - dragOffset.x;
        let newY = rawY - dragOffset.y;
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;

        setNodes((nds) =>
          nds.map((n) =>
            n.id === isDraggingNode ? { ...n, x: newX, y: newY } : n
          )
        );
      }
    },
    [isDraggingNode, dragOffset]
  );

  const handleGlobalMouseUp = useCallback(() => {
    setIsDraggingNode(null);
    if (connectingSource) {
      setConnectingSource(null);
    }
  }, [connectingSource]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [handleMouseMove, handleGlobalMouseUp]);

  // --- Connection Logic ---
  const startConnection = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setConnectingSource(nodeId);
  };

  const completeConnection = (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (connectingSource && connectingSource !== targetId) {
      const exists = edges.find(
        (edge) => edge.source === connectingSource && edge.target === targetId
      );

      if (!exists) {
        const sourceNode = nodes.find((n) => n.id === connectingSource);
        const targetNode = nodes.find((n) => n.id === targetId);

        let label: string | undefined;

        // Decision Logic: Left = No, Right = Yes
        if (sourceNode?.type === "decision" && targetNode) {
          if (targetNode.x < sourceNode.x) {
            label = "No";
          } else {
            label = "Yes";
          }
        }

        setEdges((eds) => [
          ...eds,
          {
            id: crypto.randomUUID(),
            source: connectingSource,
            target: targetId,
            label,
          },
        ]);
      }
    }
    setConnectingSource(null);
  };

  const handleNodeMouseUp = (e: React.MouseEvent, nodeId: string) => {
    if (connectingSource) {
      completeConnection(e, nodeId);
      return;
    }
    if (isDraggingNode) {
      setIsDraggingNode(null);
      e.stopPropagation();
      return;
    }
  };

  // --- Deletion & Editing ---
  const deleteSelected = useCallback(() => {
    if (!selection) return;

    if (selection.type === "node") {
      setNodes((nds) => nds.filter((n) => n.id !== selection.id));
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== selection.id && e.target !== selection.id
        )
      );
    } else if (selection.type === "edge") {
      setEdges((eds) => eds.filter((e) => e.id !== selection.id));
    }

    setSelection(null);
    setEditingId(null);
  }, [selection]);

  const handleDoubleClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingId(id);
    setIsDraggingNode(null);
  };

  const handleLabelChange = (id: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, label: newLabel } : n))
    );
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, editingId]);

  // --- Auto Layout Algorithm ---
  const handleSaveAndLayout = () => {
    // 1. Build Graph Relationships
    const childrenMap = new Map<string, string[]>();
    const parentsMap = new Map<string, string[]>();
    nodes.forEach((n) => {
      childrenMap.set(n.id, []);
      parentsMap.set(n.id, []);
    });
    edges.forEach((e) => {
      childrenMap.get(e.source)?.push(e.target);
      parentsMap.get(e.target)?.push(e.source);
    });

    // 2. Determine Levels (BFS)
    let roots = nodes.filter((n) => (parentsMap.get(n.id)?.length || 0) === 0);
    if (roots.length === 0 && nodes.length > 0) roots = [nodes[0]];

    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const queue: { id: string; level: number }[] = roots.map((n) => ({
      id: n.id,
      level: 0,
    }));
    let maxLevel = 0;

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      levels.set(id, level);
      maxLevel = Math.max(maxLevel, level);

      const children = childrenMap.get(id) || [];
      children.forEach((childId) => {
        queue.push({ id: childId, level: level + 1 });
      });
    }

    // 3. Group Nodes by Level and Sort
    const levelsArray: string[][] = [];
    for (let i = 0; i <= maxLevel; i++) levelsArray[i] = [];

    nodes.forEach((n) => {
      const l = levels.get(n.id) ?? 0;
      if (!levelsArray[l]) levelsArray[l] = [];
      levelsArray[l].push(n.id);
    });

    const spacingX = 60;
    const spacingY = 120;
    const updatedPositions = new Map<string, { x: number; y: number }>();
    const CENTER_X = (canvasRef.current?.clientWidth || 1000) / 2;

    for (let l = 0; l <= maxLevel; l++) {
      const rowNodes = levelsArray[l];

      if (l > 0) {
        rowNodes.sort((a, b) => {
          const parentsA = parentsMap.get(a) || [];
          const parentsB = parentsMap.get(b) || [];

          const avgA =
            parentsA.length > 0
              ? parentsA.reduce(
                  (sum, pid) => sum + (updatedPositions.get(pid)?.x || 0),
                  0
                ) / parentsA.length
              : 0;
          const avgB =
            parentsB.length > 0
              ? parentsB.reduce(
                  (sum, pid) => sum + (updatedPositions.get(pid)?.x || 0),
                  0
                ) / parentsB.length
              : 0;

          if (parentsA.length === 0 && parentsB.length === 0) return 0;
          if (parentsA.length === 0) return 1;
          if (parentsB.length === 0) return -1;

          return avgA - avgB;
        });
      }

      const totalWidth =
        rowNodes.length * NODE_WIDTH + (rowNodes.length - 1) * spacingX;
      let currentX = CENTER_X - totalWidth / 2;

      rowNodes.forEach((nid) => {
        const newPos = {
          x: currentX,
          y: 100 + l * (NODE_HEIGHT + spacingY),
        };
        updatedPositions.set(nid, newPos);
        currentX += NODE_WIDTH + spacingX;
      });
    }

    setNodes((prev) =>
      prev.map((n) => {
        const newPos = updatedPositions.get(n.id);
        return newPos ? { ...n, ...newPos } : n;
      })
    );

    console.log("Graph Saved:", { nodes, edges });
  };

  // --- Rendering ---
  const selectedNode =
    selection?.type === "node"
      ? nodes.find((n) => n.id === selection.id)
      : null;
  const connectingNode = nodes.find((n) => n.id === connectingSource);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-20">
        <div className="p-4 border-b border-slate-100">
          <h1 className="font-bold text-lg flex items-center gap-2 text-slate-800">
            <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <GripVertical size={18} />
            </span>
            TreeBuilder
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Drag shapes to the canvas
          </p>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Flow Elements
          </div>
          {["start", "process", "decision", "end"].map((t) => (
            <div
              key={t}
              draggable
              onDragStart={(e) => handleDragStart(e, t as NodeType)}
              className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-grab hover:bg-white hover:shadow-md hover:border-blue-300 transition-all active:cursor-grabbing"
            >
              <NodeIcon
                type={t as NodeType}
                className="w-5 h-5 text-slate-600"
              />
              <span className="capitalize font-medium text-slate-700">{t}</span>
            </div>
          ))}
        </div>

        {/* Properties Panel */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            {selection?.type === "edge" ? "Connection Selected" : "Properties"}
          </div>

          {selection?.type === "edge" ? (
            <div className="flex flex-col gap-3">
              <div className="text-sm text-slate-600 bg-blue-50 p-3 rounded border border-blue-100">
                Connection selected. Press{" "}
                <span className="font-bold">Delete</span> to remove.
              </div>
              <button
                onClick={deleteSelected}
                className="flex items-center justify-center gap-1 text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded text-sm font-medium transition-colors w-full"
              >
                <Trash2 size={14} /> Delete Connection
              </button>
            </div>
          ) : selectedNode ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Label
                </label>
                <input
                  type="text"
                  value={selectedNode.label}
                  onChange={(e) =>
                    handleLabelChange(selectedNode.id, e.target.value)
                  }
                  className="w-full px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Double-click node to edit inline
                </p>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-400">
                  ID: {selectedNode.id.slice(0, 4)}...
                </span>
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1 text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic text-center py-4">
              Select a node or connection
            </div>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-slate-100 overflow-hidden flex flex-col">
        {/* Toolbar Left */}
        <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur p-1 rounded-lg border border-slate-200 shadow-sm flex gap-2 items-center">
          <button
            onClick={() => {
              setNodes([]);
              setEdges([]);
              setSelection(null);
            }}
            className="p-2 hover:bg-slate-100 rounded-md text-slate-600 tooltip"
            title="Clear Canvas"
          >
            <Trash2 size={18} />
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
            <MousePointer2 size={14} />
            <span>Select items to edit</span>
          </div>
        </div>

        {/* Toolbar Right (Save & Arrange) */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={handleSaveAndLayout}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95 font-medium text-sm"
          >
            <Layout size={16} />
            Save & Arrange
          </button>
        </div>

        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-crosshair"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onMouseDown={() => {
            setSelection(null);
            setEditingId(null);
          }} // Deselect on canvas click
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        >
          {/* SVG Layer for Connections */}
          <svg className="absolute inset-0 w-full h-full z-0 overflow-visible pointer-events-none">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
              <marker
                id="arrowhead-selected"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const source = nodes.find((n) => n.id === edge.source);
              const target = nodes.find((n) => n.id === edge.target);
              if (!source || !target) return null;

              const pathD = getEdgePath(source, target);
              const isSelected =
                selection?.type === "edge" && selection.id === edge.id;

              // Calculate Midpoint for Label
              const sx = source.x + NODE_WIDTH / 2;
              const sy = source.y + NODE_HEIGHT / 2;
              const tx = target.x + NODE_WIDTH / 2;
              const ty = target.y + NODE_HEIGHT / 2;
              const midX = (sx + tx) / 2;
              const midY = (sy + ty) / 2;

              return (
                <g key={edge.id}>
                  {/* Invisible wide path for easier clicking */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="20"
                    className="pointer-events-auto cursor-pointer hover:stroke-blue-500/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelection({ id: edge.id, type: "edge" });
                    }}
                  />
                  {/* Visible Path */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isSelected ? "#3b82f6" : "#94a3b8"}
                    strokeWidth={isSelected ? "3" : "2"}
                    markerEnd={
                      isSelected
                        ? "url(#arrowhead-selected)"
                        : "url(#arrowhead)"
                    }
                    className="pointer-events-none transition-all transition-[d] duration-300 ease-in-out"
                  />

                  {/* Label for Decision Edges */}
                  {edge.label && (
                    <g
                      transform={`translate(${midX}, ${midY})`}
                      className="pointer-events-none"
                    >
                      <rect
                        x="-16"
                        y="-10"
                        width="32"
                        height="20"
                        rx="10"
                        fill={edge.label === "Yes" ? "#dcfce7" : "#fee2e2"}
                        stroke={edge.label === "Yes" ? "#16a34a" : "#dc2626"}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        className={`text-[10px] font-bold ${
                          edge.label === "Yes"
                            ? "fill-green-700"
                            : "fill-red-700"
                        }`}
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Active Connection Line (Ghost line while connecting) */}
            {connectingSource && connectingNode && (
              <path
                d={getEdgePath(connectingNode, mousePos)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead-selected)"
              />
            )}
          </svg>

          {/* Nodes Layer */}
          {nodes.map((node) => {
            const isSelected =
              selection?.type === "node" && selection.id === node.id;
            const isEditing = editingId === node.id;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => startMovingNode(e, node.id, node.x, node.y)}
                onMouseUp={(e) => handleNodeMouseUp(e, node.id)}
                onDoubleClick={(e) => handleDoubleClick(e, node.id)}
                className={getNodeStyles(node.type, isSelected)}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  transition:
                    isDraggingNode === node.id
                      ? "none"
                      : "left 0.3s ease, top 0.3s ease", // Smooth transition for auto-layout
                }}
              >
                {/* Connection Handle */}
                {!isEditing && (
                  <div
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-transparent flex items-center justify-center cursor-crosshair group z-20"
                    onMouseDown={(e) => startConnection(e, node.id)}
                  >
                    <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full group-hover:scale-125 transition-transform shadow-sm" />
                  </div>
                )}

                {/* Icon & Label or Input */}
                <div className="flex flex-col items-center gap-2 w-full px-2">
                  {!isEditing && (
                    <NodeIcon type={node.type} className="w-5 h-5 opacity-75" />
                  )}

                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={node.label}
                      onChange={(e) =>
                        handleLabelChange(node.id, e.target.value)
                      }
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full text-center bg-white/50 border border-blue-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="max-w-full truncate text-center leading-tight pointer-events-none select-none">
                      {node.label}
                    </span>
                  )}
                </div>

                {/* Node Type Badge (Hide when editing) */}
                {!isEditing && (
                  <div
                    className={`absolute -top-2 left-2 text-[9px] uppercase font-bold tracking-wider px-1 rounded ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {node.type}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
