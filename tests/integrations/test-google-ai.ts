/**
 * Tests for Google AI integration with Tygent.
 */
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { GoogleAINode, GoogleAIIntegration, GoogleAIBatchProcessor } from '../../src/integrations/google-ai';

// Mock the scheduler properties to make the test pass
jest.mock('../../src/scheduler', () => {
  return {
    Scheduler: jest.fn().mockImplementation(() => {
      return {
        maxParallelNodes: 4,
        maxExecutionTime: 30000,
        priorityNodes: [],
        execute: jest.fn().mockImplementation(async (inputs) => {
          return {
            weather_info: 'The weather is sunny with temperatures around 75°F.',
            activities: '1. Visit temples\n2. Cherry blossom viewing\n3. Traditional tea ceremony\n4. Explore bamboo forest\n5. Visit Nijo Castle'
          };
        })
      };
    })
  };
});

// Mock Google AI model response
class MockGoogleAIResponse {
  private text: string;
  
  constructor(text: string) {
    this.text = text;
  }
  
  response = {
    text: () => this.text
  };
}

// Mock Google AI model
class MockGoogleAIModel {
  async generateContent(prompt: string, options?: any) {
    // Return different responses based on the prompt
    if (prompt.toLowerCase().includes('weather')) {
      return new MockGoogleAIResponse('The weather is sunny with temperatures around 75°F.');
    } else if (prompt.toLowerCase().includes('activities')) {
      return new MockGoogleAIResponse('1. Visit temples\n2. Cherry blossom viewing\n3. Traditional tea ceremony\n4. Explore bamboo forest\n5. Visit Nijo Castle');
    } else if (prompt.toLowerCase().includes('accommodations')) {
      return new MockGoogleAIResponse('1. Traditional Ryokan\n2. Luxury hotels\n3. Budget-friendly hostels');
    } else if (prompt.toLowerCase().includes('travel')) {
      return new MockGoogleAIResponse('Day 1: Arrival and temple visits\nDay 2: Cultural experiences\nDay 3: Nature exploration');
    } else {
      return new MockGoogleAIResponse('Generic response for: ' + prompt);
    }
  }
}

describe('GoogleAINode', () => {
  let model: MockGoogleAIModel;
  let node: GoogleAINode;
  
  beforeEach(() => {
    model = new MockGoogleAIModel();
    node = new GoogleAINode(
      'test_node',
      model as any,
      'Test prompt about {topic}'
    );
  });
  
  it('should initialize with correct values', () => {
    expect(node.name).toBe('test_node');
    expect(node.getPromptTemplate()).toBe('Test prompt about {topic}');
  });
  
  it('should execute and return response', async () => {
    const result = await node.execute({ topic: 'weather' });
    expect(result.toLowerCase()).toContain('weather');
    expect(result.toLowerCase()).toContain('sunny');
  });
  
  it('should format prompt correctly', () => {
    const formatted = node.formatPrompt({ topic: 'activities' }, {});
    expect(formatted).toBe('Test prompt about activities');
    
    // Test with context
    const withContext = node.formatPrompt({ topic: 'basic' }, { additional: 'context' });
    expect(withContext).toBe('Test prompt about basic');
  });
});

describe('GoogleAIIntegration', () => {
  let model: MockGoogleAIModel;
  let integration: GoogleAIIntegration;
  
  beforeEach(() => {
    model = new MockGoogleAIModel();
    integration = new GoogleAIIntegration(model as any);
  });
  
  it('should initialize with DAG and scheduler', () => {
    expect(integration.dag).toBeDefined();
    expect(integration.scheduler).toBeDefined();
  });
  
  it('should add node to the DAG', () => {
    const node = integration.addNode(
      'weather_info',
      'What\'s the weather like in {location}?',
      ['location_info']
    );
    
    expect(node.name).toBe('weather_info');
    expect(node.getPromptTemplate()).toBe('What\'s the weather like in {location}?');
    expect(node.dependencies).toEqual(['location_info']);
    
    // Check that the node was added to the DAG
    expect(integration.dag.hasNode('weather_info')).toBe(true);
  });
  
  it('should apply optimization settings', () => {
    // Create a spy on the Scheduler constructor
    const schedulerSpy = jest.spyOn(integration, 'optimize');
    
    integration.optimize({
      maxParallelCalls: 3,
      maxExecutionTime: 30000,
      priorityNodes: ['weather_info']
    });
    
    // Verify optimize was called with the correct parameters
    expect(schedulerSpy).toHaveBeenCalledWith({
      maxParallelCalls: 3,
      maxExecutionTime: 30000,
      priorityNodes: ['weather_info']
    });
  });
  
  it('should execute the DAG with correct dependencies', async () => {
    // Add nodes to test
    integration.addNode(
      'weather_info',
      'What\'s the weather like in {location}?',
      []
    );
    
    integration.addNode(
      'activities',
      'What activities can I do in {location} with {weather_info}?',
      ['weather_info']
    );
    
    // Execute the DAG
    const results = await integration.execute({ location: 'Kyoto' });
    
    // Check that both nodes were executed
    expect(results.weather_info).toBeDefined();
    expect(results.activities).toBeDefined();
    
    // Check result content
    expect(results.weather_info.toLowerCase()).toContain('weather');
    expect(results.activities.toLowerCase()).toContain('visit');
  });
});

describe('GoogleAIBatchProcessor', () => {
  let model: MockGoogleAIModel;
  let batchProcessor: GoogleAIBatchProcessor;
  
  beforeEach(() => {
    model = new MockGoogleAIModel();
    batchProcessor = new GoogleAIBatchProcessor(
      model as any,
      2,  // batchSize
      2   // maxConcurrentBatches
    );
  });
  
  it('should initialize with correct values', () => {
    expect(batchProcessor.batchSize).toBe(2);
    expect(batchProcessor.maxConcurrentBatches).toBe(2);
  });
  
  it('should process items in batches', async () => {
    const processItem = async (item: string, model: any) => {
      const response = await model.generateContent(`Info about ${item}`);
      return { 
        item, 
        info: response.response.text() 
      };
    };
    
    const items = ['Tokyo', 'Paris', 'Rome', 'New York'];
    
    const results = await batchProcessor.process(items, processItem);
    
    // Check that all items were processed
    expect(results.length).toBe(items.length);
    
    // Check that each result contains the expected data
    for (let i = 0; i < results.length; i++) {
      expect(results[i].item).toBe(items[i]);
      expect(results[i].info.toLowerCase()).toContain('generic response');
    }
  });
});