/**
 * Tests for Microsoft AI integration with Tygent.
 */
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { MicrosoftAINode, MicrosoftAIIntegration, SemanticKernelOptimizer } from '../../src/integrations/microsoft-ai';

// Mock Azure OpenAI response
class MockAzureOpenAIResponse {
  private choices: { text: string }[];
  
  constructor(text: string) {
    this.choices = [{ text }];
  }
}

// Mock Azure OpenAI client
class MockAzureOpenAIClient {
  async getCompletions(options: any) {
    const prompt = options.prompt || '';
    const deploymentId = options.deploymentId || '';
    
    // Return different responses based on the prompt
    if (prompt.toLowerCase().includes('market overview')) {
      return new MockAzureOpenAIResponse('The renewable energy market in Southeast Asia is growing rapidly...');
    } else if (prompt.toLowerCase().includes('trends')) {
      return new MockAzureOpenAIResponse('1. Increased solar adoption\n2. Wind energy expansion\n3. Battery storage innovations');
    } else if (prompt.toLowerCase().includes('competitors')) {
      return new MockAzureOpenAIResponse('Top competitors include: 1. SunPower Corp, 2. First Solar, 3. NextEra Energy');
    } else if (prompt.toLowerCase().includes('regulatory')) {
      return new MockAzureOpenAIResponse('Key regulations include renewable energy targets and feed-in tariffs.');
    } else if (prompt.toLowerCase().includes('growth')) {
      return new MockAzureOpenAIResponse('Growth opportunities: 1. Microgrids for island communities, 2. Solar-plus-storage solutions');
    } else if (prompt.toLowerCase().includes('strategy')) {
      return new MockAzureOpenAIResponse('Market entry strategy: Start with partnerships to establish local presence.');
    } else {
      return new MockAzureOpenAIResponse('Generic response for: ' + prompt);
    }
  }
}

// Mock Semantic Kernel function
class MockSemanticFunction {
  private name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  async invoke(input: string) {
    return `Processed ${this.name}: ${input}`;
  }
}

// Mock Semantic Kernel plugin
class MockSKPlugin {
  name: string = 'TextAnalysis';
  sentimentAnalysis: MockSemanticFunction;
  summarize: MockSemanticFunction;
  
  constructor() {
    this.sentimentAnalysis = new MockSemanticFunction('sentiment_analysis');
    this.summarize = new MockSemanticFunction('summarize');
  }
}

// Mock Semantic Kernel
class MockSemanticKernel {
  functions: any = {};
  
  createFunction(promptTemplate: string, config: any) {
    return new MockSemanticFunction('custom_function');
  }
}

describe('MicrosoftAINode', () => {
  let client: MockAzureOpenAIClient;
  let node: MicrosoftAINode;
  
  beforeEach(() => {
    client = new MockAzureOpenAIClient();
    node = new MicrosoftAINode(
      'test_node',
      client as any,
      'gpt-4',
      'Analysis of {topic}'
    );
  });
  
  it('should initialize with correct values', () => {
    expect(node.name).toBe('test_node');
    expect(node.deploymentId).toBe('gpt-4');
    expect(node.promptTemplate).toBe('Analysis of {topic}');
  });
  
  it('should execute and return response', async () => {
    const result = await node.execute({ topic: 'market trends' });
    expect(result.toLowerCase()).toContain('solar');
    expect(result.toLowerCase()).toContain('adoption');
  });
  
  it('should format prompt correctly', () => {
    const formatted = node.formatPrompt({ topic: 'competitors' }, {});
    expect(formatted).toBe('Analysis of competitors');
    
    // Test with context
    const withContext = node.formatPrompt({ topic: 'basic' }, { additional: 'context' });
    expect(withContext).toBe('Analysis of basic');
  });
});

describe('MicrosoftAIIntegration', () => {
  let client: MockAzureOpenAIClient;
  let integration: MicrosoftAIIntegration;
  
  beforeEach(() => {
    client = new MockAzureOpenAIClient();
    integration = new MicrosoftAIIntegration(client as any, 'gpt-4');
  });
  
  it('should initialize with DAG and scheduler', () => {
    expect(integration.dag).toBeDefined();
    expect(integration.scheduler).toBeDefined();
    expect(integration.deploymentId).toBe('gpt-4');
  });
  
  it('should add node to the DAG', () => {
    const node = integration.addNode(
      'market_overview',
      'Provide a market overview of {industry} in {region}',
      ['industry_research']
    );
    
    expect(node.name).toBe('market_overview');
    expect(node.promptTemplate).toBe('Provide a market overview of {industry} in {region}');
    expect(node.dependencies).toEqual(['industry_research']);
    
    // Check that the node was added to the DAG
    expect(integration.dag.hasNode('market_overview')).toBe(true);
  });
  
  it('should apply optimization settings', () => {
    integration.optimize({
      maxParallelCalls: 3,
      maxExecutionTime: 30000,
      priorityNodes: ['market_overview']
    });
    
    // Verify the settings were applied
    expect(integration.scheduler.maxParallelNodes).toBe(3);
    expect(integration.scheduler.maxExecutionTime).toBe(30000);
    expect(integration.scheduler.priorityNodes).toEqual(['market_overview']);
  });
  
  it('should execute the DAG with correct dependencies', async () => {
    // Add nodes to test
    integration.addNode(
      'market_overview',
      'Provide a market overview of {industry} in {region}',
      []
    );
    
    integration.addNode(
      'market_trends',
      'What are the top trends in {industry} in {region} that match this overview: {market_overview}',
      ['market_overview']
    );
    
    // Execute the DAG
    const results = await integration.execute({
      industry: 'renewable energy',
      region: 'Southeast Asia'
    });
    
    // Check that both nodes were executed
    expect(results.market_overview).toBeDefined();
    expect(results.market_trends).toBeDefined();
    
    // Check result content
    expect(results.market_overview.toLowerCase()).toContain('renewable');
    expect(results.market_trends.toLowerCase()).toContain('solar');
  });
});

describe('SemanticKernelOptimizer', () => {
  let kernel: MockSemanticKernel;
  let plugin: MockSKPlugin;
  let optimizer: SemanticKernelOptimizer;
  
  beforeEach(() => {
    kernel = new MockSemanticKernel();
    plugin = new MockSKPlugin();
    optimizer = new SemanticKernelOptimizer(kernel as any);
  });
  
  it('should initialize with correct values', () => {
    expect(optimizer.dag).toBeDefined();
    expect(optimizer.scheduler).toBeDefined();
    expect(optimizer.kernel).toBe(kernel);
    expect(Object.keys(optimizer.plugins).length).toBe(0);
  });
  
  it('should register a plugin', () => {
    optimizer.registerPlugin(plugin, 'text_analysis');
    
    // Verify the plugin was registered
    expect(optimizer.plugins['text_analysis']).toBe(plugin);
    
    // Verify that nodes were created for the plugin functions
    expect(optimizer.dag.hasNode('text_analysis_sentimentAnalysis')).toBe(true);
    expect(optimizer.dag.hasNode('text_analysis_summarize')).toBe(true);
  });
  
  it('should create a plan', () => {
    // Register plugin first
    optimizer.registerPlugin(plugin);
    
    // Create a plan
    const result = optimizer.createPlan('Analyze sentiment and provide recommendations');
    
    // Verify the result is the optimizer itself (for chaining)
    expect(result).toBe(optimizer);
  });
  
  it('should apply optimization settings', () => {
    optimizer.optimize({
      maxParallelCalls: 2,
      maxExecutionTime: 10000,
      priorityNodes: ['TextAnalysis_sentimentAnalysis']
    });
    
    // Verify the settings were applied
    expect(optimizer.scheduler.maxParallelNodes).toBe(2);
    expect(optimizer.scheduler.maxExecutionTime).toBe(10000);
    expect(optimizer.scheduler.priorityNodes).toEqual(['TextAnalysis_sentimentAnalysis']);
  });
  
  it('should execute with registered plugins', async () => {
    // Register plugin and create function nodes
    optimizer.registerPlugin(plugin);
    
    // Execute with input
    const results = await optimizer.execute({
      input: 'The product is excellent but the customer service needs improvement.'
    });
    
    // Check the results
    // Both functions should have been called
    expect(results['TextAnalysis_sentimentAnalysis']).toBeDefined();
    expect(results['TextAnalysis_summarize']).toBeDefined();
    
    // Check result content
    expect(results['TextAnalysis_sentimentAnalysis']).toContain('sentiment_analysis');
    expect(results['TextAnalysis_summarize']).toContain('summarize');
  });
});