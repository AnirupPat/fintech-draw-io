import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Trash2,
  Play,
  Square,
  Diamond,
  Circle,
  GripVertical,
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
    ? "ring-2 ring-blue-500 ring-offset-2 border-blue-600"
    : "border-slate-300 hover:border-slate-400";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Dragging State (Moving an existing node)
  const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connecting State (Drawing a line)
  const [connectingSource, setConnectingSource] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

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
    if (editingId === id) return; // Don't move if editing text

    e.preventDefault(); // Prevent browser text selection
    e.stopPropagation();

    if (connectingSource) return;

    setIsDraggingNode(id);
    setSelectedId(id);

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
        // Snap to grid
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

  // Global mouse up to catch releases outside the node
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
        setEdges((eds) => [
          ...eds,
          {
            id: crypto.randomUUID(),
            source: connectingSource,
            target: targetId,
          },
        ]);
      }
    }
    setConnectingSource(null);
  };

  // --- Unified Node MouseUp Handler (The Fix) ---
  const handleNodeMouseUp = (e: React.MouseEvent, nodeId: string) => {
    // Case 1: Completing a connection (Drawing a line)
    if (connectingSource) {
      completeConnection(e, nodeId);
      return;
    }

    // Case 2: Finishing a move (Dragging the node)
    // We explicitly handle this here because the 'completeConnection' logic
    // or event bubbling might otherwise block the global window listener.
    if (isDraggingNode) {
      setIsDraggingNode(null);
      e.stopPropagation(); // Prevent clicking through to canvas (which would deselect)
      return;
    }
  };

  // --- Deletion & Editing ---
  const deleteSelected = () => {
    if (!selectedId) return;
    const isNode = nodes.find((n) => n.id === selectedId);
    if (isNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== selectedId && e.target !== selectedId)
      );
    }
    setSelectedId(null);
    setEditingId(null);
  };

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

  const handleInputBlur = () => {
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setEditingId(null);
    }
  };

  // --- Rendering ---

  const renderPath = (x1: number, y1: number, x2: number, y2: number) => {
    // const deltaX = Math.abs(x2 - x1);
    // If mostly vertical
    if (Math.abs(y2 - y1) > Math.abs(x2 - x1)) {
      return `M ${x1} ${y1} C ${x1} ${y1 + 50}, ${x2} ${y2 - 50}, ${x2} ${y2}`;
    }
    // Mostly horizontal
    return `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
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
            Properties
          </div>
          {selectedNode ? (
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
              Select a node to edit
            </div>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-slate-100 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur p-1 rounded-lg border border-slate-200 shadow-sm flex gap-2">
          <button
            onClick={() => {
              setNodes([]);
              setEdges([]);
            }}
            className="p-2 hover:bg-slate-100 rounded-md text-slate-600 tooltip"
            title="Clear Canvas"
          >
            <Trash2 size={18} />
          </button>
          <div className="w-px bg-slate-200 mx-1"></div>
          <span className="text-xs text-slate-500 flex items-center px-2">
            Double-click node to edit text
          </span>
        </div>

        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-crosshair"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => {
            setSelectedId(null);
            setEditingId(null);
          }}
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        >
          {/* SVG Layer for Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
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
            </defs>
            {edges.map((edge) => {
              const source = nodes.find((n) => n.id === edge.source);
              const target = nodes.find((n) => n.id === edge.target);
              if (!source || !target) return null;

              const sx = source.x + NODE_WIDTH / 2;
              const sy = source.y + NODE_HEIGHT / 2;
              const tx = target.x + NODE_WIDTH / 2;
              const ty = target.y + NODE_HEIGHT / 2;

              return (
                <path
                  key={edge.id}
                  d={renderPath(sx, sy, tx, ty)}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
              );
            })}

            {/* Active Connection Line */}
            {connectingSource && (
              <path
                d={renderPath(
                  nodes.find((n) => n.id === connectingSource)!.x +
                    NODE_WIDTH / 2,
                  nodes.find((n) => n.id === connectingSource)!.y +
                    NODE_HEIGHT / 2,
                  mousePos.x,
                  mousePos.y
                )}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            )}
          </svg>

          {/* Nodes Layer */}
          {nodes.map((node) => {
            const isSelected = selectedId === node.id;
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
                  zIndex: isSelected || isEditing ? 10 : 1,
                }}
              >
                {/* Connection Handle */}
                {!isEditing && (
                  <div
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-transparent flex items-center justify-center cursor-crosshair group"
                    onMouseDown={(e) => startConnection(e, node.id)}
                  >
                    <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full group-hover:scale-125 transition-transform" />
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
                      onBlur={handleInputBlur}
                      onKeyDown={handleKeyDown}
                      onMouseDown={(e) => e.stopPropagation()} // Stop drag start when clicking input
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
