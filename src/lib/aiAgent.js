import { validateArgumentCandidate } from './sessionOverlay.js';

let modelsCollectionPromise;

const loadModelsCollection = async () => {
  if (!modelsCollectionPromise) {
    modelsCollectionPromise = import('@earendil-works/pi-ai/providers/all')
      .then(({ builtinModels }) => builtinModels())
      .catch((error) => {
        modelsCollectionPromise = undefined;
        throw error;
      });
  }
  return modelsCollectionPromise;
};

export const loadPiCatalog = async () => {
  const models = await loadModelsCollection();
  return models.getProviders().map((provider) => ({
    id: provider.id,
    name: provider.name || provider.id,
    models: models.getModels(provider.id).map((model) => ({
      id: model.id,
      name: model.name || model.id,
      provider: model.provider,
      contextWindow: model.contextWindow,
      reasoning: Boolean(model.reasoning),
    })),
  }));
};

const systemPrompt = `你是“论证链实验室”的结构化论证采访代理。
你的唯一任务是把用户当前表达整理成一条可逐项确认的最小论证候选。
严格区分事实 F、规范桥接原则 B、待说明的结论 V。
不要推断政治身份，不要替用户接受任何命题，不要声称候选已被确认。
只调用 propose_argument_candidate 一次；不要输出聊天式答案。
事实必须可判断真假并给出支持条件和否定条件。
桥接原则必须明确说明为什么这些事实能为结论增加一项可反驳的理由。
如果原则被标为 terminal，它仍必须在后续由用户独立确认并接受相似案例检验。`;

const buildPrompt = ({ userText, scope, context }) => `请根据以下最小上下文生成结构化候选。

候选范围：${scope}
当前已确认上下文：
${JSON.stringify(context, null, 2)}

用户刚刚输入的想法：
${userText}

约束：
1. scope 必须精确等于 "${scope}"。
2. 如果 scope 是 current_target，target.text 必须与上下文中的 currentTarget.text 完全相同。
3. 如果 scope 是 current_target，direction 必须与上下文中的 currentDirection 完全相同。
4. 不要在字段中保留 API Key、服务商、对话内容、用户身份、时间或设备信息。
5. 只生成当前继续流程所必需的一条理由，不要生成整份人格或政治画像。
6. 调用工具提交候选。`;

export const proposeWithPiAgent = async ({
  config,
  userText,
  scope,
  context,
  expectedDirection = null,
  signal,
}) => {
  signal?.throwIfAborted();
  const [{ Agent }, { Type }, models] = await Promise.all([
    import('@earendil-works/pi-agent-core'),
    import('@earendil-works/pi-ai'),
    loadModelsCollection(),
  ]);
  signal?.throwIfAborted();
  const catalogModel = models.getModel(config.provider, config.model);
  if (!catalogModel) throw new Error('在 pi-ai 目录中找不到所选模型，请重新选择。');
  const model = config.baseUrl
    ? { ...catalogModel, baseUrl: config.baseUrl }
    : catalogModel;

  let capturedCandidate = null;
  const candidateTool = {
    name: 'propose_argument_candidate',
    label: '提交结构化论证候选',
    description: '提交一条等待用户检查和确认的结构化论证候选。',
    parameters: Type.Object({
      scope: Type.Union([Type.Literal('new_root'), Type.Literal('current_target')]),
      direction: Type.Union([Type.Literal('support'), Type.Literal('oppose')]),
      target: Type.Object({
        shortLabel: Type.String({ minLength: 1, maxLength: 160 }),
        text: Type.String({ minLength: 1, maxLength: 1200 }),
      }, { additionalProperties: false }),
      argument: Type.Object({
        title: Type.String({ minLength: 1, maxLength: 240 }),
        summary: Type.String({ minLength: 1, maxLength: 1600 }),
      }, { additionalProperties: false }),
      facts: Type.Array(Type.Object({
        kind: Type.Union([
          Type.Literal('stipulated'),
          Type.Literal('empirical'),
          Type.Literal('descriptive'),
        ]),
        statement: Type.String({ minLength: 1, maxLength: 1200 }),
        plainExplanation: Type.String({ minLength: 1, maxLength: 2400 }),
        truthConditions: Type.String({ minLength: 1, maxLength: 2400 }),
        falsifier: Type.String({ minLength: 1, maxLength: 2400 }),
      }, { additionalProperties: false }), { minItems: 1, maxItems: 8 }),
      bridge: Type.Object({
        kind: Type.Union([Type.Literal('bridge'), Type.Literal('terminal')]),
        shortLabel: Type.String({ minLength: 1, maxLength: 160 }),
        text: Type.String({ minLength: 1, maxLength: 1600 }),
        explanation: Type.String({ minLength: 1, maxLength: 2400 }),
        example: Type.String({ minLength: 1, maxLength: 2400 }),
      }, { additionalProperties: false }),
      stressTest: Type.Object({
        scenario: Type.String({ minLength: 1, maxLength: 3200 }),
        question: Type.String({ minLength: 1, maxLength: 1600 }),
      }, { additionalProperties: false }),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params) {
      const validation = validateArgumentCandidate(params, scope, expectedDirection);
      if (!validation.ok) throw new Error(validation.error);
      capturedCandidate = validation.value;
      return {
        content: [{ type: 'text', text: '结构化候选已提交，等待用户检查。' }],
        details: { acceptedForReview: true },
        terminate: true,
      };
    },
  };

  const streamOptions = {
    ...(config.providerOptions || {}),
    apiKey: config.apiKey,
  };
  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      messages: [],
      tools: [candidateTool],
    },
    streamFn: (selectedModel, agentContext, options) => models.streamSimple(
      selectedModel,
      agentContext,
      { ...options, ...streamOptions },
    ),
  });
  if (signal) signal.addEventListener('abort', () => agent.abort(), { once: true });
  await agent.prompt(buildPrompt({ userText, scope, context }));
  if (!capturedCandidate) throw new Error('模型没有返回可确认的结构化候选。');
  return capturedCandidate;
};
