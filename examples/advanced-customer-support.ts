/**
 * Advanced customer support workflow accelerated with Tygent.
 * Inspired by `advanced_python_example.py`.
 */

import { accelerate } from '../src';

type CustomerQuestion = {
  userId: string;
  question: string;
};

type Analysis = {
  intent: string;
  keywords: string[];
  confidence: number;
};

const KNOWLEDGE_BASE: Record<string, string> = {
  product_return: 'Products can be returned within 30 days with receipt for a full refund.',
  shipping_time: 'Standard shipping takes 3-5 business days. Express shipping takes 1-2 days.',
  account_reset: "Reset your password by selecting 'Forgot Password' on the login page.",
  product_warranty: 'Our products include a 1-year limited warranty covering manufacturing defects.',
};

const CUSTOMER_DATABASE: Record<string, { name: string; purchases: { product: string }[]; tier: string }> = {
  user123: {
    name: 'Jane Smith',
    purchases: [
      { product: 'Wireless Headphones' },
      { product: 'Smart Speaker' },
    ],
    tier: 'Premium',
  },
  user456: {
    name: 'John Doe',
    purchases: [
      { product: 'Smartphone' },
    ],
    tier: 'Basic',
  },
};

const PRODUCT_RECOMMENDATIONS: Record<string, string[]> = {
  'Wireless Headphones': ['Headphone Case', 'Bluetooth Adapter'],
  'Smart Speaker': ['Smart Bulbs', 'Speaker Stand'],
  Smartphone: ['Phone Case', 'Wireless Charger'],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeQuestion(question: string): Promise<Analysis> {
  await sleep(300);
  const text = question.toLowerCase();
  if (text.includes('return') || text.includes('refund')) {
    return { intent: 'product_return', keywords: ['return', 'refund'], confidence: 0.9 };
  }
  if (text.includes('shipping')) {
    return { intent: 'shipping_time', keywords: ['shipping'], confidence: 0.85 };
  }
  if (text.includes('password') || text.includes('reset')) {
    return { intent: 'account_reset', keywords: ['password', 'reset'], confidence: 0.88 };
  }
  if (text.includes('warranty')) {
    return { intent: 'product_warranty', keywords: ['warranty'], confidence: 0.82 };
  }
  return { intent: 'general', keywords: [], confidence: 0.5 };
}

async function searchKnowledgeBase(intent: string): Promise<string> {
  await sleep(400);
  return KNOWLEDGE_BASE[intent] ?? 'No specific information found.';
}

async function fetchCustomerProfile(userId: string) {
  await sleep(400);
  return CUSTOMER_DATABASE[userId];
}

async function recommendProducts(purchases: { product: string }[]): Promise<string[]> {
  await sleep(200);
  const recommendations = new Set<string>();
  for (const purchase of purchases) {
    for (const item of PRODUCT_RECOMMENDATIONS[purchase.product] ?? []) {
      recommendations.add(item);
    }
  }
  return Array.from(recommendations).slice(0, 3);
}

async function buildResponse(question: CustomerQuestion, kbAnswer: string, profile?: { name: string; tier: string }, recommendations: string[] = []): Promise<string> {
  await sleep(100);
  const greeting = profile ? `Hello ${profile.name},` : 'Hello,';
  const tierNote = profile?.tier === 'Premium' ? '\nAs a Premium member you have access to priority support at 1-800-555-HELP.' : '';
  const recs = recommendations.length ? `\nYou might also be interested in:\n- ${recommendations.join('\n- ')}` : '';
  return `${greeting} thanks for contacting support.\n\nRegarding "${question.question}":\n${kbAnswer}${tierNote}${recs}`;
}

async function customerSupportWorkflow(question: CustomerQuestion): Promise<string> {
  const analysis = await analyzeQuestion(question.question);
  const knowledge = await searchKnowledgeBase(analysis.intent);
  const profile = await fetchCustomerProfile(question.userId);
  const recommendations = profile ? await recommendProducts(profile.purchases) : [];
  return buildResponse(question, knowledge, profile, recommendations);
}

const acceleratedSupport = accelerate(customerSupportWorkflow);

async function main(): Promise<void> {
  const question: CustomerQuestion = {
    userId: 'user123',
    question: 'Can I return my headphones and how long does the warranty last?',
  };

  const response = await acceleratedSupport(question);
  console.log('\n=== Accelerated Support Response ===');
  console.log(response);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Advanced example failed', error);
    process.exitCode = 1;
  });
}
