/**
 * Tests for the DAG module.
 */

import { describe, it, expect } from '@jest/globals';
import { DAG } from '../src/dag';
import { ToolNode, LLMNode } from '../src/nodes';

describe('DAG', () => {
  it('should create a new DAG with the given name', () => {
    const dag = new DAG('test_dag');
    expect(dag.name).toBe('test_dag');
    expect(dag.nodes.size).toBe(0);
    expect((dag as any).edges.size).toBe(0);
  });

  it('should add nodes to the DAG', () => {
    const dag = new DAG('test_dag');
    
    const testTool = async (inputs: any) => {
      return { result: 'test' };
    };
    
    const toolNode = new ToolNode('test_tool', testTool);
    dag.addNode(toolNode);
    
    expect(dag.nodes.size).toBe(1);
    expect(dag.nodes.get('test_tool')).toBe(toolNode);
  });

  it('should add edges between nodes', () => {
    const dag = new DAG('test_dag');
    
    const tool1 = async (inputs: any) => {
      return { data: 'from_tool1' };
    };
    
    const tool2 = async (inputs: any) => {
      return { data: `processed_${inputs.data || ''}` };
    };
    
    dag.addNode(new ToolNode('tool1', tool1));
    dag.addNode(new ToolNode('tool2', tool2));
    
    dag.addEdge('tool1', 'tool2', { data: 'data' });
    
    expect((dag as any).edges.size).toBe(1);
    expect((dag as any).edges.get('tool1')).toContain('tool2');
  });

  it('should compute a valid topological order', () => {
    const dag = new DAG('test_dag');
    
    const dummyTool = async (inputs: any) => {
      return {};
    };
    
    // Create a simple diamond-shaped DAG
    //    A
    //   / \
    //  B   C
    //   \ /
    //    D
    
    ['A', 'B', 'C', 'D'].forEach(nodeId => {
      dag.addNode(new ToolNode(nodeId, dummyTool));
    });
    
    dag.addEdge('A', 'B');
    dag.addEdge('A', 'C');
    dag.addEdge('B', 'D');
    dag.addEdge('C', 'D');
    
    const order = dag.getTopologicalOrder();
    
    // Verify that A comes before B and C, and B and C come before D
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
  });
  
  it('should throw an error when a cycle is detected', () => {
    const dag = new DAG('cycle_dag');
    
    const dummyTool = async (inputs: any) => {
      return {};
    };
    
    // Create a cyclic DAG: A -> B -> C -> A
    ['A', 'B', 'C'].forEach(nodeId => {
      dag.addNode(new ToolNode(nodeId, dummyTool));
    });
    
    dag.addEdge('A', 'B');
    dag.addEdge('B', 'C');
    dag.addEdge('C', 'A');
    
    // Verify that topological sort throws an error due to cycle
    expect(() => dag.getTopologicalOrder()).toThrow(/cycle/i);
  });
});

describe('DAG Execution', () => {
  it('should execute a simple DAG', async () => {
    const dag = new DAG('math_dag');
    
    const simpleAdd = async (inputs: any) => {
      const a = inputs.a || 0;
      const b = inputs.b || 0;
      return { sum: a + b };
    };
    
    const simpleMultiply = async (inputs: any) => {
      const sum = inputs.sum || 0;
      const factor = inputs.factor || 1;
      return { product: sum * factor };
    };
    
    dag.addNode(new ToolNode('add', simpleAdd));
    dag.addNode(new ToolNode('multiply', simpleMultiply));
    
    dag.addEdge('add', 'multiply', { sum: 'sum' });
    
    // Mock execution
    const outputs: Record<string, any> = {
      add: { sum: 5 }
    };
    
    const inputs = dag.getNodeInputs('multiply', outputs);
    expect(inputs).toEqual({ sum: 5 });
    
    // Test that edge mappings are properly applied
      const multiplyNode = dag.nodes.get('multiply');
      const result = await multiplyNode!.execute(inputs);
      expect(result).toEqual({ product: 5 });
  });
});