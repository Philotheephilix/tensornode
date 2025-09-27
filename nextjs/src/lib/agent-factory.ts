import { createLLMFromEnv } from '@/lib/llm';
import {
  createAgentBootstrap,
  createToolkitConfiguration,
  createHederaClient,
  type AgentBootstrap,
} from '@/lib/agent-config';
import { HederaLangchainToolkit } from 'hedera-agent-kit';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { DynamicStructuredTool } from 'langchain/tools';

/**
 * Initialize the LLM from environment variables.
 */
export function initializeLLM() {
  try {
    return createLLMFromEnv();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid AI provider configuration';
    throw new Error(message);
  }
}

/**
 * Custom tool that logs "Hello World" to the server console.
 */
export const HelloWorldTool = new DynamicStructuredTool({
  name: 'hello_world_logger',
  description: "Logs 'Hello World' on the server console.",
  schema: {}, // No inputs required
  func: async () => {
    console.log('Hello World');
    return "Hello World logged on server.";
  },
});

/**
 * Create a Hedera toolkit instance + add our custom tools.
 */
export function createHederaToolkit(bootstrap?: AgentBootstrap, accountId?: string) {
  const agentBootstrap = bootstrap || createAgentBootstrap();
  const client = createHederaClient(agentBootstrap);
  const baseConfiguration = createToolkitConfiguration(agentBootstrap);

  if (accountId) {
    baseConfiguration.context = baseConfiguration.context || {};
    baseConfiguration.context.accountId = accountId;
  }

  const hederaToolkit = new HederaLangchainToolkit({ client, configuration: baseConfiguration });
  const tools = hederaToolkit.getTools();

  return { bootstrap: agentBootstrap, tools };
}

/**
 * Build a chat prompt template with system + history + human input.
 */
export function createChatPrompt(systemMessage: string) {
  return ChatPromptTemplate.fromMessages([
    ['system', systemMessage],
    new MessagesPlaceholder('history'),
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);
}

/**
 * Create an AgentExecutor with tools and a custom prompt.
 */
export function createAgentExecutorWithPrompt(
  llm: ReturnType<typeof createLLMFromEnv>,
  tools: any[],
  prompt: ChatPromptTemplate,
  returnIntermediateSteps = false,
) {
  const agent = createToolCallingAgent({ llm, tools: tools as any, prompt });
  return new AgentExecutor({ agent, tools: tools as any, returnIntermediateSteps });
}

/**
 * Extracts a human-readable string from a heterogeneous agent/LLM response.
 */
export function extractResultFromResponse(response: unknown): string {
  if (typeof response === 'object' && response !== null && 'output' in response) {
    const output = (response as { output: unknown }).output;

    if (typeof output === 'string') return output;

    if (Array.isArray(output)) {
      const first = output[0];
      if (first && typeof first === 'object' && 'text' in first) {
        const text = (first as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    }

    if (typeof output === 'object' && output !== null && 'text' in output) {
      const text = (output as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    }
  }
  return '';
}