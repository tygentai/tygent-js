/**
 * Simple test script for multi-agent functionality
 */

const { MultiAgentOrchestrator, createMessage } = require('./dist/multi-agent');

// Define test roles
const roles = {
  researcher: {
    name: "Researcher",
    description: "Finds information",
    systemPrompt: "You are a researcher"
  },
  critic: {
    name: "Critic",
    description: "Reviews information",
    systemPrompt: "You are a critic"
  }
};

// Run basic tests
function runTests() {
  console.log("Testing multi-agent functionality...");

  // Test message creation
  const message = createMessage('agent1', 'agent2', 'Hello', 'standard');
  console.log("Message created:", 
    message.fromAgent === 'agent1' && 
    message.toAgent === 'agent2' && 
    message.content === 'Hello' ? 
    "PASS" : "FAIL");

  // Create orchestrator
  const orchestrator = new MultiAgentOrchestrator();

  // Add agents
  for (const [agentId, role] of Object.entries(roles)) {
    orchestrator.addAgent(agentId, role);
  }
  console.log("Agents added successfully");

  // Create conversation DAG
  const dag = orchestrator.createConversationDag("Test query", { 
    parallelThinking: true,
    batchMessages: false,
    sharedMemory: true,
    earlyStopThreshold: 0
  });

  console.log("DAG created with nodes:", Object.keys(dag.nodes).join(", "));
  
  // Verify DAG structure - should have input, output, and agent nodes
  const hasCorrectNodes = 
    dag.nodes['input'] && 
    dag.nodes['output'] && 
    dag.nodes['agent_researcher'] && 
    dag.nodes['agent_critic'];
    
  console.log("DAG has correct nodes:", hasCorrectNodes ? "PASS" : "FAIL");

  // Find critical path
  const criticalPath = orchestrator.findCriticalPath(dag);
  console.log("Critical path:", criticalPath.join(" -> "));

  console.log("All tests complete!");
}

runTests();