/**
 * Simple dependency graph utility for documentation task ordering
 * Implements topological sort for DAG (Directed Acyclic Graph) traversal
 */

export interface GraphNode {
  id: string;
  dependencies: string[]; // IDs of nodes that must complete first
}

/**
 * Detect if there are cyclic dependencies in the graph
 * Returns the cycle path if found, null otherwise
 */
export function detectCycle(nodes: GraphNode[]): string[] | null {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function dfs(nodeId: string, path: string[]): string[] | null {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return null;

    for (const depId of node.dependencies) {
      if (!visited.has(depId)) {
        const cycle = dfs(depId, [...path]);
        if (cycle) return cycle;
      } else if (recursionStack.has(depId)) {
        // Found cycle
        return [...path, depId];
      }
    }

    recursionStack.delete(nodeId);
    return null;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const cycle = dfs(node.id, []);
      if (cycle) return cycle;
    }
  }

  return null;
}

/**
 * Get all nodes that are ready (all dependencies satisfied)
 * @param nodes All nodes in the graph
 * @param completedIds IDs of already completed nodes
 * @returns Array of ready node IDs
 */
export function getReadyNodes(nodes: GraphNode[], completedIds: Set<string>): string[] {
  return nodes
    .filter((node) => {
      // Node is not already completed
      if (completedIds.has(node.id)) return false;

      // All dependencies are satisfied
      return node.dependencies.every((depId) => completedIds.has(depId));
    })
    .map((node) => node.id);
}

/**
 * Topological sort for dependency-ordered execution
 * Returns nodes in execution order (dependencies before dependents)
 * Throws error if cycle detected
 */
export function topologicalSort(nodes: GraphNode[]): string[] {
  const cycle = detectCycle(nodes);
  if (cycle) {
    throw new Error(`Cyclic dependency detected: ${cycle.join(' → ')}`);
  }

  const sorted: string[] = [];
  const completed = new Set<string>();

  while (sorted.length < nodes.length) {
    const ready = getReadyNodes(nodes, completed);

    if (ready.length === 0 && sorted.length < nodes.length) {
      // Should not happen if cycle detection worked
      throw new Error('Cannot resolve dependencies - possible cycle or invalid references');
    }

    // Add all ready nodes (can be executed in parallel if needed)
    for (const nodeId of ready) {
      sorted.push(nodeId);
      completed.add(nodeId);
    }
  }

  return sorted;
}

/**
 * Merge nodes with cyclic dependencies into a single combined node
 * Used when cycles are detected during planning to create a larger, dependency-free task
 */
export function mergeCyclicNodes(nodes: GraphNode[], cycle: string[]): GraphNode {
  const cycleSet = new Set(cycle);
  const cyclicNodes = nodes.filter((n) => cycleSet.has(n.id));

  // Combined ID
  const mergedId = `merged-${cycle.join('-')}`;

  // External dependencies (dependencies outside the cycle)
  const externalDeps = new Set<string>();
  for (const node of cyclicNodes) {
    for (const dep of node.dependencies) {
      if (!cycleSet.has(dep)) {
        externalDeps.add(dep);
      }
    }
  }

  return {
    id: mergedId,
    dependencies: Array.from(externalDeps),
  };
}
