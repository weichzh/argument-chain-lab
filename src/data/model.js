import { applyReadableChinese } from './readableText.js';

export const MODEL_META = {
  "id": "minimal-bridge-dialogue",
  "version": "0.5.0",
  "title": "论证链实验室",
  "subtitle": "逐层检查事实、规范原则与当前基本价值",
  "updatedAt": "2026-07-12"
};

export const claims = {
  "speech_support": {
    "id": "speech_support",
    "kind": "policy",
    "policyId": "speech_restriction",
    "direction": "support",
    "shortLabel": "应采纳",
    "text": "国家应该通过并执行这项法律：禁止公开发表“严重贬损某个宗教、民族或国家象征”的言论。"
  },
  "speech_oppose": {
    "id": "speech_oppose",
    "kind": "policy",
    "policyId": "speech_restriction",
    "direction": "oppose",
    "shortLabel": "不应采纳",
    "text": "国家不应该通过这项禁止“严重贬损某个宗教、民族或国家象征”的法律。"
  },
  "surveillance_support": {
    "id": "surveillance_support",
    "kind": "policy",
    "policyId": "metadata_surveillance",
    "direction": "support",
    "shortLabel": "应采纳",
    "text": "国家应该实施这项制度：保存所有成年人的通信元数据五年，供安全机关查询。"
  },
  "surveillance_oppose": {
    "id": "surveillance_oppose",
    "kind": "policy",
    "policyId": "metadata_surveillance",
    "direction": "oppose",
    "shortLabel": "不应采纳",
    "text": "国家不应该实施这项保存所有成年人通信元数据五年的制度。"
  },
  "income_support": {
    "id": "income_support",
    "kind": "policy",
    "policyId": "income_floor",
    "direction": "support",
    "shortLabel": "应采纳",
    "text": "国家应该向每名成年人按月发放一笔不附带工作条件的基本现金收入。"
  },
  "income_oppose": {
    "id": "income_oppose",
    "kind": "policy",
    "policyId": "income_floor",
    "direction": "oppose",
    "shortLabel": "不应采纳",
    "text": "国家不应该实施这项不附带工作条件的普遍现金支付方案。"
  },
  "carbon_support": {
    "id": "carbon_support",
    "kind": "policy",
    "policyId": "carbon_fee",
    "direction": "support",
    "shortLabel": "应采纳",
    "text": "国家应该对化石燃料中的碳收费，并把净收入按人头等额返还。"
  },
  "carbon_oppose": {
    "id": "carbon_oppose",
    "kind": "policy",
    "policyId": "carbon_fee",
    "direction": "oppose",
    "shortLabel": "不应采纳",
    "text": "国家不应该实施这项碳费与等额返还方案。"
  },
  "prevent_severe_harm": {
    "id": "prevent_severe_harm",
    "kind": "bridge",
    "shortLabel": "在没有较温和替代时预防严重伤害",
    "text": "如果一项措施确实能明显减少死亡或重伤，而且没有同样有效、但对个人限制更小的办法，那么这为国家采用该措施提供了一项初步理由。",
    "explanation": "前面的事实只说明措施会减少严重伤害。这条原则另外加入一个价值判断：减少死亡或重伤，在没有较温和替代时，能够成为国家行动的理由。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "protect_nonharmful_choice": {
    "id": "protect_nonharmful_choice",
    "kind": "bridge",
    "shortLabel": "保护不伤害他人的选择",
    "text": "如果一种行为不包含直接威胁、针对个人的骚扰、欺诈，也不控制他人的身体或财产，那么国家原则上不应通过刑罚、全民监控或其他强制手段，大幅限制这种行为以及与它有关的正常联系。",
    "explanation": "事实部分是“这种行为没有直接伤害或控制他人”；价值部分是“国家因此应当克制使用强制手段”。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "constrain_discretionary_power": {
    "id": "constrain_discretionary_power",
    "kind": "bridge",
    "shortLabel": "限制可以任意使用的公权力",
    "text": "如果公权力可以在缺少明确规则、公开理由和独立审查的情况下，选择性地干预个人，那么国家有一项取消这种权力或严格限制它的理由。",
    "explanation": "这条原则并不先判断权力是否已经被滥用，而是认为：能够不受规则约束地选择性干预，本身就需要受到限制。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "equal_public_participation": {
    "id": "equal_public_participation",
    "kind": "bridge",
    "shortLabel": "消除可以避免的公共参与障碍",
    "text": "如果一种可以避免的制度安排，长期使某些公民更难进入公共机构、使用公共服务或参与公共决策，那么国家有一项修改这种安排的理由。",
    "explanation": "事实部分是持续存在的参与差距；价值部分是制度不应让某些公民长期处于较低的参与地位。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "review_high_cost_coercion": {
    "id": "review_high_cost_coercion",
    "kind": "bridge",
    "shortLabel": "重大强制决定必须可以申诉",
    "text": "如果国家依据可能出错的事实判断，对个人施加拘留、冻结财产、限制出境或其他重大强制，而且错误造成的损失很难恢复，那么国家应设置及时、独立并允许当事人质疑的审查和申诉程序。",
    "explanation": "事实部分是“判断可能出错，而且错了会造成重大损失”；价值部分是“这种决定不能只由原机关单方面作出并维持”。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "secure_material_capacity": {
    "id": "secure_material_capacity",
    "kind": "bridge",
    "shortLabel": "保障基本生活条件",
    "text": "如果一项负担得起的措施能明显减少缺少食物、住所、必要能源或基本医疗的人数，而且没有造成更大规模的同类损失，那么国家有一项采用它的理由。反过来，如果一项政策会使一部分人失去这些基本条件，又没有充分补偿，国家就有一项拒绝或修改该政策的理由。",
    "explanation": "这条原则不预先指定福利、税收或补贴工具，只把基本生活条件的明显改善或恶化，连接到政策选择。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "require_reciprocal_contribution": {
    "id": "require_reciprocal_contribution",
    "kind": "bridge",
    "shortLabel": "在能力和机会相近时要求相称贡献",
    "text": "如果一项共同制度只有依靠成员持续贡献才能维持，而某个人与其他人有相近的能力和机会，却长期拒绝作出任何贡献，那么制度有一项要求他承担相称负担的理由。",
    "explanation": "这条原则把能力、机会和实际贡献放在一起判断；它不要求所有人无条件承担完全相同的负担。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "protect_legitimate_control": {
    "id": "protect_legitimate_control",
    "kind": "bridge",
    "shortLabel": "保护以非欺诈、非强制方式取得的资源",
    "text": "如果一个人通过没有欺诈、没有强制的生产或交换取得资源，那么国家要征收这些资源，不能只以“多数人更喜欢这样”为理由，而需要提出更充分的说明。",
    "explanation": "事实部分是资源的取得方式；价值部分是这种取得方式会产生一项应被认真考虑的控制主张，但不是绝对所有权。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "account_for_future_harm": {
    "id": "account_for_future_harm",
    "kind": "bridge",
    "shortLabel": "把未来人的重大损失纳入判断",
    "text": "如果今天的行动会在可以估计的时间内，提高未来人遭受死亡、重伤、基本生活条件丧失或大规模财产损失的概率，那么决策不能仅仅因为损失发生得较晚，就把它忽略。",
    "explanation": "这条原则只反对因出生时间较晚而自动降低损失的重要性；损失有多大、概率多高，仍然属于事实问题。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "preserve_error_correction": {
    "id": "preserve_error_correction",
    "kind": "bridge",
    "shortLabel": "保留发现和纠正公共错误的渠道",
    "text": "如果禁止某类不含威胁的表达，会明显降低公共错误被发现、公开和纠正的可能性，那么国家有一项不实施这种禁令的理由。",
    "explanation": "事实部分是禁令会减少可核实信息的出现；价值部分是公共制度应当保留发现和纠正错误的能力。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "democratic_authorization": {
    "id": "democratic_authorization",
    "kind": "bridge",
    "shortLabel": "公开而平等的民主程序提供一项理由",
    "text": "如果一项强制政策通过公开程序制定，受影响的人大体拥有平等的参与机会，而且政策可以被审查和撤换，那么这一程序会为政策的权威提供一项初步理由。",
    "explanation": "这不表示多数决定一定正确，也不表示程序可以压倒所有个人权利；它只把可追踪的共同参与视为一项支持理由。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "avoid_ineffective_coercion": {
    "id": "avoid_ineffective_coercion",
    "kind": "bridge",
    "shortLabel": "停止不能实现目标的强制政策",
    "text": "如果可靠证据显示，一项强制政策不能实现它公开宣称的目标，而且继续执行还会持续消耗大量人员、时间或财政资源，那么国家有一项停止或不采用它的理由。",
    "explanation": "这条原则把“政策不能实现目标”与“仍然使用强制和公共资源”连接到停止政策的理由。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "preserve_cooperation_conditions": {
    "id": "preserve_cooperation_conditions",
    "kind": "bridge",
    "shortLabel": "保护社会和平合作的基本条件",
    "text": "如果一种可以避免的行为会明显提高有组织暴力或公共制度失灵的概率，而且限制这种行为不会造成更大的同类风险，那么国家有一项限制它的理由。",
    "explanation": "这里关注的是有组织暴力和公共制度失灵，不是把一般反对、抗议或冒犯等同于社会崩溃。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "enable_exit_from_dependency": {
    "id": "enable_exit_from_dependency",
    "kind": "bridge",
    "shortLabel": "让受控制者有现实的退出选择",
    "text": "如果一种制度安排使一方能够通过切断另一方的食物、住所或必要医疗，迫使对方服从，那么国家有一项为受控制者提供现实退出选择的理由。",
    "explanation": "事实部分是某人控制了他人唯一的基本资源来源；价值部分是受控制者不应只能以服从来换取生存条件。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "prevent_cost_shifting": {
    "id": "prevent_cost_shifting",
    "kind": "bridge",
    "shortLabel": "不把可控制的损失单方面留给他人",
    "text": "如果一项活动会增加未同意的第三方所承担的身体或财产损失，而且行为者能够控制这项活动的规模，那么制度有一项让行为者承担相应成本的理由。",
    "explanation": "这条原则把可测量的第三方损失和行为者的控制能力连接到成本分担；它不自动等于惩罚或道德谴责。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "respect_personal_authorship": {
    "id": "respect_personal_authorship",
    "kind": "bridge",
    "shortLabel": "主要影响本人生活的选择应由本人作出",
    "text": "如果一项选择主要改变行为者自己的生活，而且不直接控制他人的身体、财产或同等选择空间，那么制度有一项把决定留给行为者本人的理由，而不是由他人替他作出。",
    "explanation": "事实部分是后果主要落在本人生活中；价值部分是个人应当对自己的生活安排保有决定权。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "protect_agency_preconditions": {
    "id": "protect_agency_preconditions",
    "kind": "bridge",
    "shortLabel": "保护作出和执行选择所需的最低能力",
    "text": "如果一种可以避免的制度安排，使人失去形成、修改或执行生活计划所必需的最低身体和物质条件，而且修正它不会让其他人遭受同等程度的能力损失，那么制度有一项修正这种安排的理由。",
    "explanation": "这条原则关注的是人能否实际作出和执行选择，而不只是法律上是否写着“可以选择”。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "equal_standing_under_coercion": {
    "id": "equal_standing_under_coercion",
    "kind": "bridge",
    "shortLabel": "受强制的人应能知道理由并提出反证",
    "text": "如果国家用强制手段改变某个人的行动、资源或法律资格，那么受影响的人应当能够知道决定理由、提出质疑，并用相关证据影响最终决定。",
    "explanation": "这条原则认为，受强制的人不是被动对象，而是有资格参与理由交换的人。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "require_answerable_power": {
    "id": "require_answerable_power",
    "kind": "bridge",
    "shortLabel": "公权力必须说明理由并接受独立复核",
    "text": "如果公权力可以单方面改变个人的基本选择、资格或资源，而当事人又不能及时取得理由或申请独立复核，那么制度有一项用公开规则、理由说明和独立审查限制这种权力的理由。",
    "explanation": "这条原则把权力的可说明性和可复核性，作为防止任意决定的制度条件。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "preserve_institutional_learning": {
    "id": "preserve_institutional_learning",
    "kind": "bridge",
    "shortLabel": "让制度能够发现错误并据此修改",
    "text": "如果一项制度要长期可靠，就必须能够识别、传递和纠正错误，那么制度有一项保留这些信息渠道的理由；除非这些渠道本身会造成更大的同类损失。",
    "explanation": "事实部分是制度修正依赖信息；价值部分是制度应当具备根据错误进行改进的能力。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "assign_burdens_to_controllers": {
    "id": "assign_burdens_to_controllers",
    "kind": "bridge",
    "shortLabel": "让能够控制损失来源的人承担相应负担",
    "text": "如果某个人能够控制的活动，明显增加了未同意第三方的身体或财产损失，那么制度有一项让能够改变这项活动的人承担相应负担的理由，而不是把损失全部留给第三方。",
    "explanation": "这里强调因果控制和负担分配。它不把“造成损失”直接等同于“有罪”或“应受惩罚”。",
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "equal_agency": {
    "id": "equal_agency",
    "kind": "terminal",
    "shortLabel": "平等的个人决定权",
    "text": "每个有能力安排自己生活的人，在不伤害或控制他人的范围内，都应当拥有同等的决定权，不应由他人仅因不赞同而替他作出选择。",
    "explanation": "如果你独立接受这句话，并且不再用另一条规范原则说明它，系统才把它记为本轮的当前基本价值。",
    "stressTest": {
      "scenario": "一名成年人选择一种多数人认为低俗、没有益处的生活方式。这个选择不威胁、不欺诈，也不控制他人。禁止它只会让多数人感觉更舒服，不会减少可测量的身体或财产损失。",
      "question": "在这个案例中，你是否仍认为这种不伤害他人的生活选择应由本人决定？",
      "distinctions": [
        "当事人不是具有完整决定能力的成年人",
        "这种行为实际上会伤害未同意的他人",
        "这种选择会剥夺他人的同等选择空间"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "non_domination": {
    "id": "non_domination",
    "kind": "terminal",
    "shortLabel": "不受可以任意使用的权力支配",
    "text": "任何人都不应处在这样的权力关系中：他人可以随时干预其基本选择，却不受明确规则约束，也不必给出能够被质疑的理由。",
    "explanation": "重点不只是权力有没有被实际滥用，而是某个人是否一直掌握可以任意使用的控制能力。",
    "stressTest": {
      "scenario": "一名管理者拥有随时查看员工私人通信的权限。他承诺不会滥用，过去也没有查阅过，但该权限没有使用规则、操作记录或外部审查。",
      "question": "即使管理者目前表现克制，你是否仍认为这项权限应当受到限制？",
      "distinctions": [
        "员工可以随时且没有代价地撤回同意",
        "权限只有多人共同批准才能启动",
        "每次使用都会自动接受独立审查"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "bodily_security": {
    "id": "bodily_security",
    "kind": "terminal",
    "shortLabel": "避免死亡和重伤",
    "text": "避免人的死亡、重伤或其他严重身体损害，是公共制度必须给予很高权重的一项理由。",
    "explanation": "这是一个价值判断。某项政策是否真的能减少伤害、能减少多少，仍然需要由事实证据回答。",
    "stressTest": {
      "scenario": "一项措施可以确定避免少量重伤，但会长期限制所有成年人的一项日常选择，而且没有完全无代价的替代方案。",
      "question": "即使这项措施有其他代价，避免重伤是否仍然至少构成支持它的一项理由？",
      "distinctions": [
        "相关风险由当事人充分知情并自愿承担",
        "措施本身会造成同等程度的身体损害",
        "存在同样有效但限制更小的替代办法"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "equal_civic_status": {
    "id": "equal_civic_status",
    "kind": "terminal",
    "shortLabel": "平等的公民资格",
    "text": "公共制度应把每个公民都当作具有同等资格的参与者，不能把某些群体长期固定在较低的政治或公共地位。",
    "explanation": "这不要求所有结果完全相同，但要求制度能够说明为什么某些人持续更难参与公共生活。",
    "stressTest": {
      "scenario": "一个群体在法律上有投票权，但所有公共听证会长期只安排在该群体无法进入的场所。没有人公开宣布要排斥他们。",
      "question": "即使形式上的投票权相同，制度是否仍应修改这种安排？",
      "distinctions": [
        "进入差异完全由个人可以控制的选择造成",
        "调整会剥夺另一群体同等程度的参与机会",
        "差异只发生一次，而且事先无法预见"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "procedural_justification": {
    "id": "procedural_justification",
    "kind": "terminal",
    "shortLabel": "重大强制决定必须可以质疑和复核",
    "text": "国家对个人作出重大强制决定时，应当说明理由，并允许独立机构审查，也应给受影响的人提出反证和申诉的机会。",
    "explanation": "这条原则认为，程序是否允许质疑，本身就是强制权是否得到说明的一部分，不能只看最后结果是否碰巧正确。",
    "stressTest": {
      "scenario": "一名判断几乎从不出错的官员，可以秘密决定谁被限制出境。决定通常确实能预防风险，但当事人不知道证据，也没有申诉渠道。",
      "question": "即使这名官员的准确率很高，你是否仍认为这种决定必须允许申诉和独立复核？",
      "distinctions": [
        "危险非常紧急，事前审查在时间上不可能完成",
        "事后审查可以完全恢复全部损失",
        "公开具体证据会直接暴露受害者身份"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "material_floor": {
    "id": "material_floor",
    "kind": "terminal",
    "shortLabel": "基本生活条件",
    "text": "任何人都不应因为可以避免的资源匮乏，而失去维持生存、身体健康和最低限度实际选择所需要的食物、住所、能源或医疗。",
    "explanation": "这是对基本生活条件应当具有何种价值地位的承诺，不是关于某项具体福利政策是否有效的事实判断。",
    "stressTest": {
      "scenario": "一个人因为连续作出高风险选择而失去食物和住所。最低救助不会补偿其全部损失，也不会免除以后对其行为的责任。",
      "question": "即使匮乏与他自己的选择有关，保证最低食物和住所是否仍然构成一项理由？",
      "distinctions": [
        "救助会立即使其他人陷入同等程度的匮乏",
        "当事人拒绝所有不会增加风险的可行替代方案",
        "现有资源不足以同时维持所有人的最低条件"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "reciprocity": {
    "id": "reciprocity",
    "kind": "terminal",
    "shortLabel": "共同制度中的相称贡献",
    "text": "在必须依靠共同负担才能维持的制度中，能力、机会和既有负担相近的人，应当承担大体可比较的贡献义务。",
    "explanation": "能力不足、机会缺失、照护劳动和其他既有负担都可以构成相关差别，因此这不是要求每个人机械地付出相同数量。",
    "stressTest": {
      "scenario": "两个人从同一公共制度获得相同收益，也有相近的能力和机会。一人持续贡献，另一人有能力贡献却始终拒绝。",
      "question": "在这些条件下，制度是否有理由要求第二个人作出相称贡献？",
      "distinctions": [
        "第二个人未被统计的照护劳动已经构成贡献",
        "制度收益并不依赖成员共同贡献",
        "退出制度现实可行而且不会把成本留给其他人"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "legitimate_control": {
    "id": "legitimate_control",
    "kind": "terminal",
    "shortLabel": "对以非欺诈、非强制方式取得资源的控制",
    "text": "个人对通过没有欺诈、没有强制的生产或交换取得的资源，拥有一项不应被随意取消的控制主张。",
    "explanation": "这不是绝对所有权。它只说明资源的取得方式会产生一项需要与其他理由共同权衡的价值主张。",
    "stressTest": {
      "scenario": "某人通过自愿交换积累了大量非必需资源。征收其中一小部分，可以建设多数人喜欢的公共装饰，但不会改善任何人的食物、住所、身体状态或法律资格。",
      "question": "在这个案例中，资源的取得方式是否仍构成反对征收的一项理由？",
      "distinctions": [
        "取得过程包含没有补偿的第三方损失",
        "控制这些资源本身阻断了他人的同等资格",
        "既有公开规则已经明确约定这项负担"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "future_equal_weight": {
    "id": "future_equal_weight",
    "kind": "terminal",
    "shortLabel": "未来人的重大损失不能只因时间而被轻视",
    "text": "不能仅仅因为一些人出生得更晚，就给他们可以预见的死亡、重伤或其他重大损失更低的价值权重。",
    "explanation": "这不排除根据概率、机会成本或不确定性作调整；它只否认“出生时间较晚”本身足以降低一个人的地位。",
    "stressTest": {
      "scenario": "今天获得一项很小的便利，会在五十年后确定使另一群人遭受严重身体损害。今天和未来受影响的人数相同。",
      "question": "你是否认为未来损害应当进入同一项权衡，而不能仅因发生得晚就忽略？",
      "distinctions": [
        "未来损害的概率极低而且无法可靠估计",
        "延迟行动会使今天的人遭受同等程度的损害",
        "未来人有成本更低并且现实可行的规避办法"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "error_correction": {
    "id": "error_correction",
    "kind": "terminal",
    "shortLabel": "公共制度应保留发现和纠正错误的能力",
    "text": "公共制度应保留发现、公开和纠正错误的渠道，即使这些渠道有时会引起不适、冒犯或短期冲突。",
    "explanation": "这条原则不会自动压倒对直接威胁、欺诈或具体无辜者隐私的保护，但把可纠错性本身视为一项重要理由。",
    "stressTest": {
      "scenario": "一份证据完整的调查会使一个广受尊敬的机构在短期内失去信任，但隐瞒调查结果会让已经确认的错误继续存在。",
      "question": "在这种情况下，公共纠错是否仍构成公开调查结果的一项理由？",
      "distinctions": [
        "公开会暴露具体无辜者的身份",
        "证据还没有达到可以核实的标准",
        "延迟公开不会让错误扩大或继续造成损失"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "democratic_authorship": {
    "id": "democratic_authorship",
    "kind": "terminal",
    "shortLabel": "受规则约束的人应能平等参与制定规则",
    "text": "受到共同规则约束的人，应当有可以追踪并且大体平等的机会，参与制定、审查和撤换这些规则。",
    "explanation": "民主参与本身可以为规则提供一项权威理由，但不能把任何多数结果自动变成正确，也不能消除其他价值的限制。",
    "stressTest": {
      "scenario": "一项规则经过事先公开、每人一票并且参与充分的投票通过，但它禁止少数人的一种不伤害他人的生活方式。",
      "question": "即使这项规则可能被个人自由等其他理由压倒，民主程序是否仍然至少提供一项支持其权威的理由？",
      "distinctions": [
        "少数人被排除在程序之外",
        "表决内容涉及任何多数都不能取消的平等公民资格",
        "投票所依赖的信息受到系统性伪造"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "non_waste": {
    "id": "non_waste",
    "kind": "terminal",
    "shortLabel": "不继续维持明知无效的强制手段",
    "text": "如果一种强制手段可以预见地不能实现它公开宣称的目标，而且还占用可以用于其他事项的资源，制度不应仅仅因为惯性继续维持它。",
    "explanation": "这条原则关注的是手段已经与目标脱节，却仍继续使用强制和公共资源。",
    "stressTest": {
      "scenario": "一项政策连续多年没有改变目标指标，可靠评估也预测继续执行不会改变结果。取消政策只会迫使机构承认过去判断错误。",
      "question": "在这种情况下，停止这项政策是否仍然有理由？",
      "distinctions": [
        "现有指标遗漏了真实但暂时无法测量的效果",
        "停止政策会造成更高的过渡损失",
        "政策仍然承担另一个已经公开说明的目标"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  },
  "peaceful_cooperation": {
    "id": "peaceful_cooperation",
    "kind": "terminal",
    "shortLabel": "维持不依赖有组织暴力的共同生活",
    "text": "公共制度必须重视这样一种基本条件：互不相识的人可以在不诉诸有组织暴力的情况下共同生活、交换和合作。",
    "explanation": "这不表示政府可以用“维持秩序”为由压制一般反对或非暴力抗议。关键是有组织暴力和共同制度能否继续运作。",
    "stressTest": {
      "scenario": "公开一项真实信息会引发短期大规模抗议，但抗议者没有组织暴力计划，公共机构仍能继续运作。",
      "question": "仅凭“维持和平合作”这一原则，是否足以支持压制这项真实信息？",
      "distinctions": [
        "已经存在可以验证的有组织暴力计划",
        "公共服务会立即中断并造成严重身体损害",
        "限制只会延迟很短时间而且保留独立复核"
      ]
    },
    "responseGuide": "请暂时把相关事实当作成立，再判断你是否接受这条包含“应该”的原则。"
  }
};

export const facts = {
  "speech_scope_noncoercive": {
    "id": "speech_scope_noncoercive",
    "kind": "stipulated",
    "statement": "这项法案只管公开表达。直接威胁、针对个人的骚扰、能够查证的虚假事实陈述，以及组织暴力的指令，都不在法案范围内。",
    "truthConditions": "法案文字明确排除这四类行为，而且题目没有另外加入其他强制行为。",
    "falsifier": "只要法案实际覆盖其中任何一类行为，或者题目还包含没有说明的强制行为，这句话就不成立。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "speech_reduces_serious_assaults": {
    "id": "speech_reduces_serious_assaults",
    "kind": "empirical",
    "statement": "在可比地区实施这项法律后，针对特定群体的重伤案件，按三年平均计算，至少减少了 20%。把同期治安投入的变化计算进去后，这个降幅仍然存在。",
    "truthConditions": "研究使用统一的案件统计口径、可比的对照地区，并把同期治安投入纳入分析后，估计降幅仍不低于 20%。",
    "falsifier": "高质量研究发现案件没有明显下降、案件反而增加，或者降幅可以完全由同期治安投入增加解释。",
    "note": "这句话只谈法律是否造成了至少 20% 的降幅，不包含“20% 是否足够重要”的价值判断。",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "speech_no_equal_alternative": {
    "id": "speech_no_equal_alternative",
    "kind": "empirical",
    "statement": "在同一批地区，增加反暴力执法、加强受害者保护和资助反向表达，三项合起来也没有达到这项法律对重伤案件的减少效果。",
    "truthConditions": "采用同样的统计口径比较后，替代方案组合的估计效果明显低于这项法律，而且误差范围也不支持两者效果相同。",
    "falsifier": "存在限制更小的方案，在同样条件下达到或超过这项法律的估计效果。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "speech_participation_gap_reduced": {
    "id": "speech_participation_gap_reduced",
    "kind": "empirical",
    "statement": "法律实施后，原来经常遭受贬损的群体参加公开听证、使用公共服务和报名公职的比例，与其他可比群体之间的差距连续三年缩小。",
    "truthConditions": "行政数据和调查数据使用相同口径，三项差距在实施后连续三年下降，而且主要的同期变化已经被纳入分析。",
    "falsifier": "差距没有缩小，只是短期波动后恢复，或者变化可以由人口结构和公共服务供给变化解释。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "speech_preexisting_participation_barrier": {
    "id": "speech_preexisting_participation_barrier",
    "kind": "empirical",
    "statement": "法律实施前，即使把收入、教育、年龄和地区差异计算进去，经常遭受贬损的群体参加公开听证、使用公共服务和报名公职的比例仍然持续较低；遭受贬损越多，这种差距通常越大。",
    "truthConditions": "连续多年的数据都显示：控制收入、教育、年龄和地区后，差距仍稳定存在，而且贬损暴露程度可以预测差距大小。",
    "falsifier": "控制这些因素后差距消失，或者贬损暴露程度不能再预测参与差距。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "speech_enforcement_variance": {
    "id": "speech_enforcement_variance",
    "kind": "empirical",
    "statement": "表达内容相同、其他情况也相同，只因为说话者的身份不同，不同执法单位给出的立案概率就明显不同。",
    "truthConditions": "盲测或审计样本显示，在控制表达内容和具体情境后，说话者身份仍能明显预测是否立案。",
    "falsifier": "控制内容和情境后，身份不再影响立案概率，或者差异可以由其他可观察的行为差别解释。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "speech_open_standard_no_review": {
    "id": "speech_open_standard_no_review",
    "kind": "stipulated",
    "statement": "法条只使用“严重贬损”这个说法，却没有列出可以执行的具体判断标准；立案机关不必公开每个案件的理由，立案前也没有独立机构复核。",
    "truthConditions": "开放性表述、个案理由不公开、立案前没有独立复核，这三个条件同时存在。",
    "falsifier": "法条列出清楚而可执行的标准，或者个案理由必须公开，或者立案前必须经过独立复核。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "speech_blocks_verified_reporting": {
    "id": "speech_blocks_verified_reporting",
    "kind": "empirical",
    "statement": "法律实施后，包含可靠证据的腐败或机构失误报道减少了；其他举报渠道并没有增加同等数量、同样经过核实的披露。",
    "truthConditions": "报道记录和举报记录采用事先确定的核实标准，合计后的已核实披露数量确实下降。",
    "falsifier": "已核实披露的总量没有下降，或者减少的只是没有可靠证据的内容。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "speech_organized_violence_link": {
    "id": "speech_organized_violence_link",
    "kind": "empirical",
    "statement": "题目所说的这类表达，能够预测随后七天内是否出现有组织的暴力动员；即使排除已经知道的动员网络，这种预测关系仍然存在。",
    "truthConditions": "事先登记的统计模型在另一批样本中仍能得到同方向结果，而且研究设计排除了已知动员网络和明显的反向因果。",
    "falsifier": "换一批样本后无法重复这个结果，或者这种关系可以完全由原有动员网络解释。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "speech_restriction_no_greater_cooperation_risk": {
    "id": "speech_restriction_no_greater_cooperation_risk",
    "kind": "empirical",
    "statement": "在同一评估范围内，这项法律引发的有组织暴力事件和关键公共服务中断数量，少于它减少的同类事件数量。",
    "truthConditions": "使用统一口径计算后，法律新增的同类事件总数低于它减少的总数。",
    "falsifier": "法律引发的有组织暴力或公共服务中断数量，等于或超过它减少的数量。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "surveillance_scope": {
    "id": "surveillance_scope",
    "kind": "stipulated",
    "statement": "这项制度会保存所有成年人的通信时间、联系双方的标识和位置元数据，保存期为五年。机关查询时不需要先有针对某个人的嫌疑，也不需要事前取得独立司法批准。",
    "truthConditions": "制度文本同时包含这些数据种类、五年保存期，以及没有个别嫌疑和事前独立批准的查询条件。",
    "falsifier": "其中任何一项与题目不同，例如只保存特定嫌疑人的数据，或者查询前必须取得独立批准。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "surveillance_prevents_attacks": {
    "id": "surveillance_prevents_attacks",
    "kind": "empirical",
    "statement": "这项制度每年能使已经进入实施阶段的致命袭击至少减少 15%，而且这个效果不能用同期情报预算增加来解释。",
    "truthConditions": "独立评估事先确定“进入实施阶段”的定义，设置可比对照，并控制情报预算后，估计降幅仍不低于 15%。",
    "falsifier": "评估发现效果接近零、方向相反，或者全部效果都可以由其他情报资源增加解释。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "surveillance_no_equal_targeted_method": {
    "id": "surveillance_no_equal_targeted_method",
    "kind": "empirical",
    "statement": "在相同预算下，只保存具体嫌疑人的数据并加快司法批准，不能达到全民保存制度减少袭击的效果。",
    "truthConditions": "可比试验或准实验显示，定向保存方案的估计效果明显低于全民保存方案。",
    "falsifier": "定向保存和加快司法批准达到或超过全民保存的效果。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "surveillance_no_greater_cooperation_risk": {
    "id": "surveillance_no_greater_cooperation_risk",
    "kind": "empirical",
    "statement": "在同一评估范围内，全民元数据保存引发的有组织暴力和关键公共服务中断数量，少于它所避免的袭击造成的同类事件数量。",
    "truthConditions": "使用统一口径计算后，制度新增的同类事件总数低于它避免的总数。",
    "falsifier": "制度引发的同类事件数量，等于或超过它所避免的数量。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "surveillance_audit_public": {
    "id": "surveillance_audit_public",
    "kind": "stipulated",
    "statement": "这项制度由公开立法通过，受影响的成年人拥有大体相同的投票和代表机会。每次查询都会自动留下记录，年度统计向社会公开，议会可以撤销制度；但具体查询仍不需要事前独立批准。",
    "truthConditions": "公开立法、参与机会、查询留痕、年度统计公开和议会可撤销这几个条件全部存在。",
    "falsifier": "其中任何一个条件不存在，或者受影响群体在制度上没有大体相同的参与机会。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "surveillance_false_positive_cost": {
    "id": "surveillance_false_positive_cost",
    "kind": "empirical",
    "statement": "由系统标记而导致的限制出境、冻结账户或拘留案件中，至少 5% 最后被确认找错了对象，而且多数损失无法完全恢复。",
    "truthConditions": "案件审计以最终裁判或独立复核为准，错误率不低于 5%，并记录了无法完全恢复的损失。",
    "falsifier": "错误率明显低于 5%，或者相关损失都能在短期内完全恢复。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "surveillance_chills_association": {
    "id": "surveillance_chills_association",
    "kind": "empirical",
    "statement": "制度实施后，没有被指控违法的记者、律师和政治团体，与消息来源之间的通信频率下降；下降主要出现在可以通过元数据识别的联系中。",
    "truthConditions": "纵向数据或自然实验显示，制度实施后这些特定联系明显减少，而且行业规模变化和通信平台迁移不能解释该变化。",
    "falsifier": "联系频率没有变化，或者下降可以由平台迁移、职业结构变化等其他因素解释。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "surveillance_discretionary_queries": {
    "id": "surveillance_discretionary_queries",
    "kind": "stipulated",
    "statement": "执行机关可以查询任何成年人的记录，不必公开这个案件的理由，也不必事前取得独立机构批准。",
    "truthConditions": "制度明确赋予执行机关这种查询能力。",
    "falsifier": "查询必须符合针对个人的明确标准，而且必须在查询前取得独立批准。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_program_scope": {
    "id": "income_program_scope",
    "kind": "stipulated",
    "statement": "每名成年人每月获得一笔现金，金额相当于可支配收入中位数的 15%。领取不以工作为条件，资金来自累进所得税，而且不会取代残障救助和紧急救助。",
    "truthConditions": "方案文本同时包含金额、无工作条件、累进所得税筹资和保留两类专项救助这四项内容。",
    "falsifier": "其中任何一项发生变化。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_reduces_deprivation": {
    "id": "income_reduces_deprivation",
    "kind": "empirical",
    "statement": "方案实施三年后，无法稳定获得食物、住所或必要药物的人口比例至少下降了 25%。",
    "truthConditions": "采用事先确定的物质匮乏指标和可比对照后，估计降幅仍不低于 25%。",
    "falsifier": "比例没有下降、降幅明显低于 25%，或者变化可以由其他同期政策解释。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_no_larger_same_loss": {
    "id": "income_no_larger_same_loss",
    "kind": "empirical",
    "statement": "税收筹资和人们行为变化带来的新增匮乏人数，少于方案帮助摆脱食物、住所或必要药物匮乏的人数。",
    "truthConditions": "税后收入和行为数据表明，新增的同类匮乏人数低于减少的人数。",
    "falsifier": "新增的同类匮乏人数等于或超过减少的人数。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_reduces_caseworker_discretion": {
    "id": "income_reduces_caseworker_discretion",
    "kind": "stipulated",
    "statement": "基础现金只根据可以核实的年龄和居住记录自动发放，个案工作人员不能用“态度不积极”等开放性标准拒绝发放。",
    "truthConditions": "发放规则只依赖年龄和居住记录，个案人员没有其他拒绝基础支付的裁量权。",
    "falsifier": "个案人员仍能根据没有列明边界的评价标准拒绝发放。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_status_quo_gatekeeping": {
    "id": "income_status_quo_gatekeeping",
    "kind": "stipulated",
    "statement": "现有基础救助允许个案工作人员用没有明确边界的“求职诚意”或“家庭支持”标准拒绝发放，而且拒绝前没有独立复核。",
    "truthConditions": "开放性的拒绝标准和拒绝前没有独立复核这两个条件同时存在。",
    "falsifier": "拒绝只能依据完整列明、可以核实的标准，或者拒绝前必须经过独立复核。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_exit_abuse": {
    "id": "income_exit_abuse",
    "kind": "empirical",
    "statement": "方案实施后，遭遇有记录的工资扣留、工作场所暴力或伴侣暴力的人，离开相关关系的比例上升。",
    "truthConditions": "纵向数据使用事先确定的事件定义，显示现金到账后退出比例上升，而且当地就业和住房供给变化不能解释这个结果。",
    "falsifier": "退出比例没有上升、反而下降，或者变化可以由其他服务扩张解释。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_dependency_control": {
    "id": "income_dependency_control",
    "kind": "empirical",
    "statement": "在相关群体中，有些雇主或伴侣控制着当事人获得食物、住所或必要医疗的唯一来源，并能通过切断这个来源，提高当事人拒绝其要求的代价。",
    "truthConditions": "个案资料和调查数据同时确认：资源来源是唯一的，控制者确实能切断它，而且切断会增加拒绝要求的损失。",
    "falsifier": "当事人有可以立即使用的替代来源，或者控制者不能改变其获得基本资源的条件。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_financed_from_voluntary_holdings": {
    "id": "income_financed_from_voluntary_holdings",
    "kind": "stipulated",
    "statement": "新增税款来自劳动报酬、投资收益和自愿交易所得；题目没有指控这些收入来自欺诈、强制或已经确认但没有补偿的第三方损失。",
    "truthConditions": "题目明确把收入来源限制在这些条件内。",
    "falsifier": "收入来自欺诈、强制，或者来自已经确认但没有补偿的第三方损失。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_noncontributors": {
    "id": "income_noncontributors",
    "kind": "empirical",
    "statement": "部分领取者与持续贡献者有相近的劳动能力、岗位机会和照护负担，却连续五年没有从事有偿劳动、照护、学习或社区服务。",
    "truthConditions": "个体数据按事先确定的标准，同时满足能力相近、机会相近、照护负担相近和连续五年没有这些活动。",
    "falsifier": "不存在这样的群体，或者他们的能力、机会、未统计贡献或照护负担与持续贡献者并不相近。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_program_requires_contributions": {
    "id": "income_program_requires_contributions",
    "kind": "stipulated",
    "statement": "这项方案只有在税基持续提供资金时才能维持每期现金支付。其他条件不变时，税收长期下降会使支付减少，或者转化为债务。",
    "truthConditions": "方案的筹资规则和预算关系都显示支付依赖持续的税收、借款或其他投入。",
    "falsifier": "在没有持续税收、借款或其他投入的情况下，支付总额仍能长期保持不变。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "income_future_burden": {
    "id": "income_future_burden",
    "kind": "empirical",
    "statement": "如果方案保持不变，未来二十年增加的净债务会通过更高税率或基础服务削减，使后续人口中至少与当前受益人数相当的一部分人，无法稳定获得食物、住所、必要能源或必要医疗。",
    "truthConditions": "经独立复核的长期预算和分配模型，在主要参数范围内都得到这种规模的后续物质匮乏。",
    "falsifier": "方案长期收支平衡，或者未来调整不会造成这种规模的基本生活条件丧失。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "carbon_program_scope": {
    "id": "carbon_program_scope",
    "kind": "stipulated",
    "statement": "方案按照化石燃料的含碳量统一收费，费率在十年内逐步提高；净收入按人头等额返还；进口商品按同一口径调整；每三年公开复核一次。",
    "truthConditions": "方案文本同时包含收费口径、十年递增、等额返还、进口调整和三年复核。",
    "falsifier": "其中任何一项发生变化。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "carbon_reduces_damage": {
    "id": "carbon_reduces_damage",
    "kind": "empirical",
    "statement": "与不实施政策相比，这项方案会使未来十年的累计温室气体排放至少减少 15%，同时降低模型中由气候变化造成的死亡、重伤或财产损失。",
    "truthConditions": "多种模型在主要参数范围内都显示排放和损失下降，而且累计排放差不低于 15%。",
    "falsifier": "排放差接近零、排放反而增加，或者死亡、重伤和财产损失没有下降。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "carbon_no_equal_alternative": {
    "id": "carbon_no_equal_alternative",
    "kind": "empirical",
    "statement": "在相同财政成本和十年期限内，已经评估的非价格政策组合，没有达到这项碳费方案的累计减排量。",
    "truthConditions": "在统一的核算范围内，可比模型都显示替代组合的减排量较低。",
    "falsifier": "存在财政成本不更高、限制也更小，而且减排量达到或超过这项方案的替代办法。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "carbon_future_loss": {
    "id": "carbon_future_loss",
    "kind": "empirical",
    "statement": "如果不采取这项政策，二十年至八十年后的人口遭受热相关死亡、洪水损失和粮食减产的概率会提高。",
    "truthConditions": "多个独立来源的模型，在规定时间范围内都显示这些指标的概率上升。",
    "falsifier": "模型不支持概率上升，或者变化可以完全由与排放无关的因素解释。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "carbon_external_costs": {
    "id": "carbon_external_costs",
    "kind": "empirical",
    "statement": "每增加一单位化石碳排放，未参与相关交易的人所承担的身体或财产损失都会增加，而且排放者可以通过技术或行为选择改变排放量。",
    "truthConditions": "归因模型得到正的边际损失估计，同时存在能够改变排放量的技术或行为选择。",
    "falsifier": "边际损失不为正，或者排放者无法控制排放量。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "carbon_bottom_decile_loss": {
    "id": "carbon_bottom_decile_loss",
    "kind": "empirical",
    "statement": "即使把等额返还计算进去，收入最低 10% 的家庭中，仍有至少 10% 在前三年无法同时支付最低食物、住所、必要医疗，以及维持就业所需的能源和交通费用。",
    "truthConditions": "家庭微观数据已经计算返还、替代行为和现有救助后，受影响比例仍不低于 10%。",
    "falsifier": "这些家庭都能同时支付上述最低费用，或者受影响比例低于 10%。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "carbon_leakage": {
    "id": "carbon_leakage",
    "kind": "empirical",
    "statement": "生产转移到境外和进口替代，抵消了境内减排的 80% 以上，使全球累计排放几乎没有变化。",
    "truthConditions": "供应链和贸易数据按消费口径核算后，抵消比例不低于 80%。",
    "falsifier": "抵消比例明显低于 80%，而且全球累计排放仍明显下降。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "carbon_tracking_discretion": {
    "id": "carbon_tracking_discretion",
    "kind": "stipulated",
    "statement": "主管机关可以使用不公开的模型调整企业排放系数，并在独立复核前追缴费用；企业无法取得模型参数。",
    "truthConditions": "制度同时赋予机关调整系数和先行追缴的能力，而且模型参数不公开。",
    "falsifier": "模型参数公开，调整受到明确规则限制，并且追缴前可以得到独立复核。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "severe_harm_removes_options": {
    "id": "severe_harm_removes_options",
    "kind": "descriptive",
    "statement": "死亡会终止一个人的全部后续行动；重伤通常会减少他还能实际完成的行动。",
    "truthConditions": "事先明确“死亡”“重伤”和“能够实际完成的行动”后，观察结果符合上述关系。",
    "falsifier": "死亡后同一个人仍能继续行动，或者重伤通常不减少任何可以实际完成的行动。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "criminal_penalty_reduces_options": {
    "id": "criminal_penalty_reduces_options",
    "kind": "descriptive",
    "statement": "罚款、拘留或刑事记录，会改变一个人可以使用的资源、可以采取的行动或未来机会。",
    "truthConditions": "至少一种法定后果对资源、行动范围或未来机会产生可以观察的变化。",
    "falsifier": "所有这些法定后果都不改变任何资源、行动范围或未来机会。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "unchecked_power_changes_dependence": {
    "id": "unchecked_power_changes_dependence",
    "kind": "descriptive",
    "statement": "当一方可以单方面干预另一方，而且不必说明理由时，后者的选择会受到前者是否决定使用这项能力的影响。",
    "truthConditions": "干预能力真实存在，可以单方启动，被干预者也不能依靠现有规则阻止。",
    "falsifier": "干预必须得到被干预者同意，或者有可以执行的规则阻止单方启动。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "participation_is_membership_mechanism": {
    "id": "participation_is_membership_mechanism",
    "kind": "descriptive",
    "statement": "投票、参加听证、提出申诉和担任公职，都是公民影响共同规则和公共机构运作的制度渠道。",
    "truthConditions": "制度规则使这些活动能够改变决定、人员安排或正式记录。",
    "falsifier": "这些活动在制度上不能改变任何决定、人员安排或正式记录。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "decision_makers_are_fallible": {
    "id": "decision_makers_are_fallible",
    "kind": "descriptive",
    "statement": "个人和机构在证据不完整时作出的判断，有时会被后来出现的证据推翻。",
    "truthConditions": "存在按照同一事实标准、后来被新证据推翻的判断案例。",
    "falsifier": "此类判断从来没有被后来证据推翻。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "deprivation_reduces_capacity": {
    "id": "deprivation_reduces_capacity",
    "kind": "descriptive",
    "statement": "缺少食物、住所或必要医疗，会降低人的存活概率、健康状况，或者减少他能实际完成的行动。",
    "truthConditions": "按事先确定的指标观察到存活、健康或可执行行动中的至少一项下降。",
    "falsifier": "这些缺失不改变任何一项指标。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "cooperation_requires_inputs": {
    "id": "cooperation_requires_inputs",
    "kind": "descriptive",
    "statement": "有些公共制度只有持续获得劳动、税款或照护投入，才能维持原有的服务数量。",
    "truthConditions": "预算关系或生产关系显示，投入减少会使服务数量下降。",
    "falsifier": "服务数量与任何持续投入都没有关系。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "voluntary_acquisition_tracks_choice": {
    "id": "voluntary_acquisition_tracks_choice",
    "kind": "descriptive",
    "statement": "在没有欺诈、没有强制的生产和交换中，资源转移与参与者能够辨认的行动和同意相对应。",
    "truthConditions": "参与者能够拒绝交易，而且资源转移与其行动和同意相符。",
    "falsifier": "参与者不能拒绝，或者资源转移与其行动和同意没有关系。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "birth_time_not_action": {
    "id": "birth_time_not_action",
    "kind": "descriptive",
    "statement": "一个人的出生时间，不是这个人在出生前能够选择或改变的事情。",
    "truthConditions": "按照“选择”的通常定义，出生前不存在这个人的选择行为。",
    "falsifier": "存在这个人在出生前选择自己出生时间的行为。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "correction_requires_information": {
    "id": "correction_requires_information",
    "kind": "descriptive",
    "statement": "如果一个错误从未被任何人发现，也没有传递给能够修改它的人，那么这个错误不会因为相关信息而得到纠正。",
    "truthConditions": "纠正过程至少需要发现错误和把信息传递给有修改能力的人这两个环节。",
    "falsifier": "一个从未被发现、也从未被传递的信息，仍能触发对该错误的纠正。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "common_rules_affect_subjects": {
    "id": "common_rules_affect_subjects",
    "kind": "descriptive",
    "statement": "具有强制力的共同规则，会改变受规则约束者可以采取的行动、可以使用的资源或将承担的法律后果。",
    "truthConditions": "规则至少对行动、资源或法律后果中的一项产生可以观察的变化。",
    "falsifier": "规则不改变任何受约束者的行动、资源或法律后果。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "ineffective_policy_uses_resources": {
    "id": "ineffective_policy_uses_resources",
    "kind": "descriptive",
    "statement": "执行一项强制政策，至少需要人员、时间、信息系统或财政支出中的一种资源。",
    "truthConditions": "预算或工作流程记录显示至少有一种投入。",
    "falsifier": "政策执行完全不需要任何人员、时间、系统或财政投入。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "organized_violence_disrupts_exchange": {
    "id": "organized_violence_disrupts_exchange",
    "kind": "descriptive",
    "statement": "持续的有组织暴力，会使人员流动、交易、公共服务运行或不同群体之间的合作至少有一项减少。",
    "truthConditions": "相关指标在有组织暴力持续期间出现下降。",
    "falsifier": "这些指标都不受持续有组织暴力影响。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "dependency_allows_compliance_pressure": {
    "id": "dependency_allows_compliance_pressure",
    "kind": "descriptive",
    "statement": "当一方能够切断另一方获得食物、住所或必要医疗的唯一来源时，这种能力会增加后者拒绝其要求的代价。",
    "truthConditions": "资源被切断后，拒绝要求所带来的预期损失上升。",
    "falsifier": "切断资源的能力不改变拒绝要求的任何代价。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "controllable_activity_causes_third_party_loss": {
    "id": "controllable_activity_causes_third_party_loss",
    "kind": "descriptive",
    "statement": "当一项可以控制的活动增加第三方的身体或财产损失时，改变活动规模会改变第三方损失的分布。",
    "truthConditions": "采用能够识别因果关系的方法后，改变活动规模会改变损失结果。",
    "falsifier": "改变活动规模不会改变第三方损失。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "personal_choice_locates_primary_consequences": {
    "id": "personal_choice_locates_primary_consequences",
    "kind": "descriptive",
    "statement": "在排除威胁、欺诈、针对个人的骚扰，以及未同意的身体或财产影响后，一名成年人是否选择某种生活方式，主要改变的是他自己的行动安排和生活计划。",
    "truthConditions": "比较选择前后，主要变化发生在行为者本人的行动、资源使用或计划安排中，而且题目确实排除了所列第三方影响。",
    "falsifier": "主要变化发生在未同意第三方的身体、财产或可执行行动中，或者题目没有排除所列影响。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "agency_requires_minimum_capabilities": {
    "id": "agency_requires_minimum_capabilities",
    "kind": "descriptive",
    "statement": "一个人死亡、长期失去意识，或者无法获得维持生命所需的食物、住所和必要医疗时，他能够形成并实际执行的生活计划会减少。",
    "truthConditions": "按照事先确定的生活计划和执行条件，至少一种状态会使可以实际执行的计划集合缩小。",
    "falsifier": "这些状态都不改变任何可以形成或执行的生活计划。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "contestability_changes_decision_input": {
    "id": "contestability_changes_decision_input",
    "kind": "descriptive",
    "statement": "当事人能够取得决定理由、提交反证并申请独立复核时，他提供的信息可能改变决定；如果这些渠道都不存在，他的信息就不能通过这些渠道进入决定过程。",
    "truthConditions": "制度流程确实允许理由送达、反证提交和独立复核，而且信息有进入决定记录的路径。",
    "falsifier": "即使渠道存在，信息也不能进入决定；或者渠道不存在时，信息仍能通过同样渠道改变决定。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "unreviewable_power_blocks_counterevidence": {
    "id": "unreviewable_power_blocks_counterevidence",
    "kind": "descriptive",
    "statement": "如果公权力不向当事人提供个案决定依据，也没有独立复核程序，那么当事人掌握的反证无法通过这个复核程序改变决定。",
    "truthConditions": "制度缺少决定依据送达和独立复核入口，因此反证没有进入该程序的路径。",
    "falsifier": "存在可以使用的理由送达和独立复核入口，而且反证能够进入决定过程。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  },
  "policy_revision_requires_performance_signals": {
    "id": "policy_revision_requires_performance_signals",
    "kind": "descriptive",
    "statement": "一个制度如果要根据执行结果修改政策，至少需要记录结果、把结果与原定目标比较，并把比较结果交给有能力修改政策的人。",
    "truthConditions": "政策修改流程中同时存在记录、比较和传递这三个环节。",
    "falsifier": "制度能够根据从未记录、比较或传递的结果修改政策。",
    "note": "",
    "responseGuide": "这里只判断这句话是否符合事实，不判断政策好坏。"
  }
};

export const argumentsById = {
  "speech_harm_support": {
    "id": "speech_harm_support",
    "targetClaimId": "speech_support",
    "title": "禁令是否能减少针对群体的重伤",
    "summary": "先判断禁令是否真的使重伤案件至少减少 20%，以及有没有同样有效、限制更小的办法。再判断：如果答案都是肯定的，减少严重伤害是否构成支持禁令的一项理由。",
    "factIds": [
      "speech_reduces_serious_assaults",
      "speech_no_equal_alternative"
    ],
    "bridgeClaimId": "prevent_severe_harm"
  },
  "speech_participation_support": {
    "id": "speech_participation_support",
    "targetClaimId": "speech_support",
    "title": "禁令是否能减少某些群体参与公共生活的障碍",
    "summary": "先判断长期贬损是否与公共参与差距有关，以及禁令实施后差距是否确实缩小。再判断：可以避免的制度性参与障碍，是否构成修改制度的一项理由。",
    "factIds": [
      "speech_preexisting_participation_barrier",
      "speech_participation_gap_reduced"
    ],
    "bridgeClaimId": "equal_public_participation"
  },
  "speech_cooperation_support": {
    "id": "speech_cooperation_support",
    "targetClaimId": "speech_support",
    "title": "禁令是否能降低有组织暴力的风险",
    "summary": "先判断这类表达是否真的会增加随后发生有组织暴力的概率，以及禁令是否没有造成更大的同类风险。再判断：保护和平合作条件是否构成限制这类表达的一项理由。",
    "factIds": [
      "speech_organized_violence_link",
      "speech_restriction_no_greater_cooperation_risk"
    ],
    "bridgeClaimId": "preserve_cooperation_conditions"
  },
  "speech_choice_oppose": {
    "id": "speech_choice_oppose",
    "targetClaimId": "speech_oppose",
    "title": "这项禁令是否限制了不直接伤害他人的表达",
    "summary": "先确认法案范围确实排除了威胁、骚扰、欺诈和暴力指令。再判断：对不直接伤害或控制他人的表达，国家是否原则上应克制使用刑罚。",
    "factIds": [
      "speech_scope_noncoercive"
    ],
    "bridgeClaimId": "protect_nonharmful_choice"
  },
  "speech_discretion_oppose": {
    "id": "speech_discretion_oppose",
    "targetClaimId": "speech_oppose",
    "title": "模糊标准是否给执法机关留下了任意选择空间",
    "summary": "先判断法条是否缺少明确标准、理由公开和独立复核，以及相同内容是否因说话者身份不同而受到不同处理。再判断：这种可以选择性使用的权力是否需要被限制。",
    "factIds": [
      "speech_open_standard_no_review",
      "speech_enforcement_variance"
    ],
    "bridgeClaimId": "constrain_discretionary_power"
  },
  "speech_correction_oppose": {
    "id": "speech_correction_oppose",
    "targetClaimId": "speech_oppose",
    "title": "禁令是否妨碍公开和纠正已经核实的错误",
    "summary": "先判断法律是否使有可靠证据的腐败或机构失误报道减少，而且其他渠道没有补足。再判断：公共纠错能力是否构成反对禁令的一项理由。",
    "factIds": [
      "speech_blocks_verified_reporting"
    ],
    "bridgeClaimId": "preserve_error_correction"
  },
  "surveillance_harm_support": {
    "id": "surveillance_harm_support",
    "targetClaimId": "surveillance_support",
    "title": "全民保存是否比定向方法更能预防致命袭击",
    "summary": "先判断全民保存是否至少减少 15% 的致命袭击，以及定向保存和加快司法批准是否达不到同样效果。再判断：在没有同效、限制更小的办法时，避免死亡和重伤是否构成支持制度的一项理由。",
    "factIds": [
      "surveillance_prevents_attacks",
      "surveillance_no_equal_targeted_method"
    ],
    "bridgeClaimId": "prevent_severe_harm"
  },
  "surveillance_demo_support": {
    "id": "surveillance_demo_support",
    "targetClaimId": "surveillance_support",
    "title": "公开立法、查询留痕和可撤销程序是否提供支持理由",
    "summary": "先确认制度是否经过公开立法，受影响者是否有大体平等的参与机会，查询是否留痕并可以由议会撤销。再判断：这种民主授权是否至少为制度提供一项理由。",
    "factIds": [
      "surveillance_audit_public"
    ],
    "bridgeClaimId": "democratic_authorization"
  },
  "surveillance_cooperation_support": {
    "id": "surveillance_cooperation_support",
    "targetClaimId": "surveillance_support",
    "title": "制度是否能保护公共服务免受有组织袭击",
    "summary": "先判断制度是否减少致命袭击、有组织暴力是否会中断公共服务，以及制度没有造成更大的同类风险。再判断：维持和平合作和公共制度运作是否构成支持制度的一项理由。",
    "factIds": [
      "surveillance_prevents_attacks",
      "organized_violence_disrupts_exchange",
      "surveillance_no_greater_cooperation_risk"
    ],
    "bridgeClaimId": "preserve_cooperation_conditions"
  },
  "surveillance_power_oppose": {
    "id": "surveillance_power_oppose",
    "targetClaimId": "surveillance_oppose",
    "title": "机关是否能够在没有独立批准时查询任何人的记录",
    "summary": "先确认机关是否可以不公开个案理由、也不经事前独立批准就查询任何成年人的记录。再判断：这种可以任意使用的查询权是否需要被取消或严格限制。",
    "factIds": [
      "surveillance_discretionary_queries"
    ],
    "bridgeClaimId": "constrain_discretionary_power"
  },
  "surveillance_procedure_oppose": {
    "id": "surveillance_procedure_oppose",
    "targetClaimId": "surveillance_oppose",
    "title": "误判会不会造成难以恢复的重大损失",
    "summary": "先判断错误对象是否至少占 5%，以及制度会不会导致拘留、冻结账户或限制出境。再判断：在事实可能出错且损失难以恢复时，是否必须设置独立审查和申诉。",
    "factIds": [
      "surveillance_false_positive_cost",
      "surveillance_scope"
    ],
    "bridgeClaimId": "review_high_cost_coercion"
  },
  "surveillance_association_oppose": {
    "id": "surveillance_association_oppose",
    "targetClaimId": "surveillance_oppose",
    "title": "制度是否使守法者减少正常联系",
    "summary": "先判断记者、律师和政治团体与消息来源的正常通信是否因元数据保存而减少。再判断：如果这些联系不含违法行为，保护不伤害他人的选择和联系是否构成反对制度的一项理由。",
    "factIds": [
      "surveillance_chills_association"
    ],
    "bridgeClaimId": "protect_nonharmful_choice"
  },
  "income_material_support": {
    "id": "income_material_support",
    "targetClaimId": "income_support",
    "title": "方案是否明显减少食物、住所和药物匮乏",
    "summary": "先判断方案是否使物质匮乏至少下降 25%，而且没有让更多其他人陷入同类匮乏。再判断：改善基本生活条件是否构成支持方案的一项理由。",
    "factIds": [
      "income_reduces_deprivation",
      "income_no_larger_same_loss"
    ],
    "bridgeClaimId": "secure_material_capacity"
  },
  "income_discretion_support": {
    "id": "income_discretion_support",
    "targetClaimId": "income_support",
    "title": "自动发放是否减少个案工作人员控制基本救助的权力",
    "summary": "先判断现行救助是否允许工作人员用模糊标准拒绝发放，以及新方案是否改为按年龄和居住记录自动发放。再判断：减少可以任意使用的拒绝权是否构成支持方案的一项理由。",
    "factIds": [
      "income_status_quo_gatekeeping",
      "income_reduces_caseworker_discretion"
    ],
    "bridgeClaimId": "constrain_discretionary_power"
  },
  "income_exit_support": {
    "id": "income_exit_support",
    "targetClaimId": "income_support",
    "title": "稳定现金是否帮助人离开暴力或扣薪关系",
    "summary": "先判断某些雇主或伴侣是否控制当事人的唯一基本资源来源，以及现金到账后退出相关关系的比例是否上升。再判断：为受控制者提供现实退出选择是否构成支持方案的一项理由。",
    "factIds": [
      "income_dependency_control",
      "income_exit_abuse"
    ],
    "bridgeClaimId": "enable_exit_from_dependency"
  },
  "income_holdings_oppose": {
    "id": "income_holdings_oppose",
    "targetClaimId": "income_oppose",
    "title": "筹资是否取自以非欺诈、非强制方式取得的收入",
    "summary": "先确认新增税款来自没有欺诈、没有强制的劳动、投资和自愿交易所得。再判断：这种取得方式是否要求国家为征收提出比多数偏好更充分的理由。",
    "factIds": [
      "income_financed_from_voluntary_holdings"
    ],
    "bridgeClaimId": "protect_legitimate_control"
  },
  "income_reciprocity_oppose": {
    "id": "income_reciprocity_oppose",
    "targetClaimId": "income_oppose",
    "title": "无条件支付是否让有能力贡献的人长期不作贡献",
    "summary": "先判断方案是否依赖持续共同投入，以及是否存在能力、机会和照护负担相近却连续五年不作任何贡献的人。再判断：共同制度中的相称贡献是否构成反对无条件支付的一项理由。",
    "factIds": [
      "income_program_requires_contributions",
      "income_noncontributors"
    ],
    "bridgeClaimId": "require_reciprocal_contribution"
  },
  "income_future_oppose": {
    "id": "income_future_oppose",
    "targetClaimId": "income_oppose",
    "title": "长期债务是否会让后续人口失去基本生活条件",
    "summary": "先判断方案保持不变是否会通过未来加税或削减基础服务，使大量后续人口陷入物质匮乏。再判断：未来人的重大损失是否必须进入今天的政策判断。",
    "factIds": [
      "income_future_burden"
    ],
    "bridgeClaimId": "account_for_future_harm"
  },
  "carbon_harm_support": {
    "id": "carbon_harm_support",
    "targetClaimId": "carbon_support",
    "title": "方案是否确实减少排放以及相关损失",
    "summary": "先判断方案是否至少减少 15% 的累计排放并降低死亡、重伤或财产损失，以及有没有同样有效、成本不更高的替代办法。再判断：在没有同效替代时预防严重伤害是否构成支持方案的一项理由。",
    "factIds": [
      "carbon_reduces_damage",
      "carbon_no_equal_alternative"
    ],
    "bridgeClaimId": "prevent_severe_harm"
  },
  "carbon_future_support": {
    "id": "carbon_future_support",
    "targetClaimId": "carbon_support",
    "title": "不采取政策是否会增加未来人的重大损失",
    "summary": "先判断不采取政策是否会提高未来热相关死亡、洪水损失和粮食减产的概率。再判断：不能只因损失发生得较晚就忽略未来人，是否构成支持方案的一项理由。",
    "factIds": [
      "carbon_future_loss"
    ],
    "bridgeClaimId": "account_for_future_harm"
  },
  "carbon_cost_support": {
    "id": "carbon_cost_support",
    "targetClaimId": "carbon_support",
    "title": "排放是否把身体和财产损失留给未参与交易的人",
    "summary": "先判断增加排放是否会增加第三方损失，而且排放者是否能够控制排放量。再判断：可控制的损失是否不应全部由未同意的第三方承担。",
    "factIds": [
      "carbon_external_costs"
    ],
    "bridgeClaimId": "prevent_cost_shifting"
  },
  "carbon_material_oppose": {
    "id": "carbon_material_oppose",
    "targetClaimId": "carbon_oppose",
    "title": "返还以后，低收入家庭是否仍无法支付必要开支",
    "summary": "先判断收入最低 10% 的家庭中，是否仍有至少 10% 无法同时支付食物、住所、医疗、能源和通勤费用。再判断：基本生活条件的损失是否构成反对或修改当前设计的一项理由。",
    "factIds": [
      "carbon_bottom_decile_loss"
    ],
    "bridgeClaimId": "secure_material_capacity"
  },
  "carbon_effectiveness_oppose": {
    "id": "carbon_effectiveness_oppose",
    "targetClaimId": "carbon_oppose",
    "title": "生产转移是否使全球排放几乎不变",
    "summary": "先判断境外生产和进口是否抵消 80% 以上的境内减排，以及政策执行是否持续消耗资源。再判断：不能实现公开目标的强制政策是否应当停止。",
    "factIds": [
      "carbon_leakage",
      "ineffective_policy_uses_resources"
    ],
    "bridgeClaimId": "avoid_ineffective_coercion"
  },
  "carbon_power_oppose": {
    "id": "carbon_power_oppose",
    "targetClaimId": "carbon_oppose",
    "title": "主管机关是否能用不公开的模型先行追缴费用",
    "summary": "先确认企业是否看不到模型参数、机关是否能单方面调整排放系数，并在复核前追缴。再判断：这种缺少公开规则和事前独立复核的权力是否需要被限制。",
    "factIds": [
      "carbon_tracking_discretion"
    ],
    "bridgeClaimId": "constrain_discretionary_power"
  },
  "choice_to_authorship": {
    "id": "choice_to_authorship",
    "targetClaimId": "protect_nonharmful_choice",
    "title": "为什么不伤害他人的生活选择通常应由本人决定",
    "summary": "先判断这类选择的主要后果是否落在行为者自己的生活中。再判断：主要安排本人生活、又不控制他人的选择，是否原则上应留给本人作出。",
    "factIds": [
      "personal_choice_locates_primary_consequences"
    ],
    "bridgeClaimId": "respect_personal_authorship"
  },
  "authorship_to_equal_agency": {
    "id": "authorship_to_equal_agency",
    "targetClaimId": "respect_personal_authorship",
    "title": "为什么个人应当决定主要影响自己生活的事情",
    "summary": "先判断这些选择是否构成一个人安排自己生活的实际部分。再判断：每个有能力安排生活的人，是否都拥有同等的个人决定权。",
    "factIds": [
      "personal_choice_locates_primary_consequences"
    ],
    "bridgeClaimId": "equal_agency"
  },
  "severe_harm_to_agency_preconditions": {
    "id": "severe_harm_to_agency_preconditions",
    "targetClaimId": "prevent_severe_harm",
    "title": "为什么死亡和重伤会构成特别重要的政策理由",
    "summary": "先判断死亡和重伤是否会终止或明显减少一个人能实际完成的行动。再判断：制度是否应保护人作出和执行选择所需的最低身体能力。",
    "factIds": [
      "severe_harm_removes_options"
    ],
    "bridgeClaimId": "protect_agency_preconditions"
  },
  "deprivation_to_agency_preconditions": {
    "id": "deprivation_to_agency_preconditions",
    "targetClaimId": "secure_material_capacity",
    "title": "为什么食物、住所和医疗匮乏会构成政策理由",
    "summary": "先判断这些匮乏是否降低生存、健康和实际行动能力。再判断：制度是否应保护人作出和执行生活计划所需的最低条件。",
    "factIds": [
      "deprivation_reduces_capacity"
    ],
    "bridgeClaimId": "protect_agency_preconditions"
  },
  "agency_preconditions_to_equal_agency": {
    "id": "agency_preconditions_to_equal_agency",
    "targetClaimId": "protect_agency_preconditions",
    "title": "为什么制度应保护最低身体和物质能力",
    "summary": "先判断形成和执行生活计划是否需要最低身体和物质条件。再判断：每个人是否都拥有同等安排自己生活的地位。",
    "factIds": [
      "agency_requires_minimum_capabilities"
    ],
    "bridgeClaimId": "equal_agency"
  },
  "discretion_to_answerability": {
    "id": "discretion_to_answerability",
    "targetClaimId": "constrain_discretionary_power",
    "title": "为什么可以任意使用的公权力需要说明理由",
    "summary": "先判断不受规则约束的单方干预能力是否会使个人的选择依赖掌权者意志。再判断：公权力是否必须依据公开规则说明理由并接受独立复核。",
    "factIds": [
      "unchecked_power_changes_dependence"
    ],
    "bridgeClaimId": "require_answerable_power"
  },
  "fallibility_to_answerability": {
    "id": "fallibility_to_answerability",
    "targetClaimId": "review_high_cost_coercion",
    "title": "为什么可能出错的重大决定需要独立复核",
    "summary": "先判断处理不完整证据的决定是否可能被后来证据推翻。再判断：公权力是否必须说明理由，并允许反证进入独立复核程序。",
    "factIds": [
      "decision_makers_are_fallible"
    ],
    "bridgeClaimId": "require_answerable_power"
  },
  "answerability_to_equal_standing": {
    "id": "answerability_to_equal_standing",
    "targetClaimId": "require_answerable_power",
    "title": "为什么当事人必须能够用反证影响强制决定",
    "summary": "先判断不提供理由、也没有独立复核，是否会阻断当事人的反证进入决定过程。再判断：受强制的人是否应当被当作能够提出理由和证据的平等参与者。",
    "factIds": [
      "unreviewable_power_blocks_counterevidence"
    ],
    "bridgeClaimId": "equal_standing_under_coercion"
  },
  "standing_to_procedure": {
    "id": "standing_to_procedure",
    "targetClaimId": "equal_standing_under_coercion",
    "title": "为什么强制程序必须允许当事人质疑",
    "summary": "先判断取得理由、提交反证和独立复核，是否会让当事人的信息有机会改变决定。再判断：重大强制决定是否必须可以被质疑和复核。",
    "factIds": [
      "contestability_changes_decision_input"
    ],
    "bridgeClaimId": "procedural_justification"
  },
  "information_to_institutional_learning": {
    "id": "information_to_institutional_learning",
    "targetClaimId": "preserve_error_correction",
    "title": "为什么发现和公开错误需要制度化的信息渠道",
    "summary": "先判断错误是否只有在被发现并传递后才可能得到纠正。再判断：制度是否应保留能够让错误被看到并触发修改的信息渠道。",
    "factIds": [
      "correction_requires_information"
    ],
    "bridgeClaimId": "preserve_institutional_learning"
  },
  "learning_to_error_correction": {
    "id": "learning_to_error_correction",
    "targetClaimId": "preserve_institutional_learning",
    "title": "为什么制度需要根据执行结果修改自己",
    "summary": "先判断政策修改是否依赖记录结果、比较目标和传递信息。再判断：公共制度是否应保留发现和纠正错误的能力。",
    "factIds": [
      "policy_revision_requires_performance_signals"
    ],
    "bridgeClaimId": "error_correction"
  },
  "cost_to_controller_burden": {
    "id": "cost_to_controller_burden",
    "targetClaimId": "prevent_cost_shifting",
    "title": "为什么能够控制损失来源的人要承担相应负担",
    "summary": "先判断改变活动规模是否会改变第三方的身体或财产损失。再判断：能够改变损失来源的人，是否不应把全部损失留给未同意的第三方。",
    "factIds": [
      "controllable_activity_causes_third_party_loss"
    ],
    "bridgeClaimId": "assign_burdens_to_controllers"
  },
  "controller_burden_to_reciprocity": {
    "id": "controller_burden_to_reciprocity",
    "targetClaimId": "assign_burdens_to_controllers",
    "title": "为什么单方面把共同成本留给他人会违反互惠",
    "summary": "先判断一方可控制的活动是否会改变第三方损失。再判断：共同合作是否要求成员不能只保留收益、却把可控制的成本全部留给其他人。",
    "factIds": [
      "controllable_activity_causes_third_party_loss"
    ],
    "bridgeClaimId": "reciprocity"
  },
  "severe_harm_to_security": {
    "id": "severe_harm_to_security",
    "targetClaimId": "prevent_severe_harm",
    "title": "为什么避免死亡和重伤本身具有很高价值",
    "summary": "先判断死亡和重伤是否会终止或明显减少人的行动能力。再判断：避免这种严重身体损害，是否本身就是制度必须高度重视的理由。",
    "factIds": [
      "severe_harm_removes_options"
    ],
    "bridgeClaimId": "bodily_security"
  },
  "choice_to_agency": {
    "id": "choice_to_agency",
    "targetClaimId": "protect_nonharmful_choice",
    "title": "为什么刑罚不应替代不伤害他人的个人选择",
    "summary": "先判断罚款、拘留或刑事记录是否会改变个人的行动和未来机会。再判断：每个人在不伤害他人的范围内，是否拥有同等的个人决定权。",
    "factIds": [
      "criminal_penalty_reduces_options"
    ],
    "bridgeClaimId": "equal_agency"
  },
  "discretion_to_domination": {
    "id": "discretion_to_domination",
    "targetClaimId": "constrain_discretionary_power",
    "title": "为什么即使尚未滥用，任意权力仍会形成支配",
    "summary": "先判断单方干预能力是否会使被干预者的选择依赖掌权者意志。再判断：任何人是否都不应处在这种无需规则和理由的控制之下。",
    "factIds": [
      "unchecked_power_changes_dependence"
    ],
    "bridgeClaimId": "non_domination"
  },
  "participation_to_status": {
    "id": "participation_to_status",
    "targetClaimId": "equal_public_participation",
    "title": "为什么持续的公共参与障碍会影响公民地位",
    "summary": "先判断投票、听证、申诉和担任公职是否确实影响共同规则。再判断：公共制度是否应把每个公民都当作同等资格的参与者。",
    "factIds": [
      "participation_is_membership_mechanism"
    ],
    "bridgeClaimId": "equal_civic_status"
  },
  "fallibility_to_procedure": {
    "id": "fallibility_to_procedure",
    "targetClaimId": "review_high_cost_coercion",
    "title": "为什么事实判断可能出错时仍需要申诉程序",
    "summary": "先判断个人和机构的判断是否可能被后来证据推翻。再判断：对个人的重大强制决定是否必须允许质疑和独立复核。",
    "factIds": [
      "decision_makers_are_fallible"
    ],
    "bridgeClaimId": "procedural_justification"
  },
  "deprivation_to_floor": {
    "id": "deprivation_to_floor",
    "targetClaimId": "secure_material_capacity",
    "title": "为什么基本物质匮乏本身值得制度处理",
    "summary": "先判断缺少食物、住所或必要医疗是否会降低生存、健康和实际行动能力。再判断：任何人是否都不应因可以避免的匮乏而失去这些最低条件。",
    "factIds": [
      "deprivation_reduces_capacity"
    ],
    "bridgeClaimId": "material_floor"
  },
  "inputs_to_reciprocity": {
    "id": "inputs_to_reciprocity",
    "targetClaimId": "require_reciprocal_contribution",
    "title": "为什么共同制度可以要求相称贡献",
    "summary": "先判断公共服务是否只有依靠持续劳动、税款或照护投入才能维持。再判断：能力、机会和既有负担相近的人是否应承担大体可比较的贡献。",
    "factIds": [
      "cooperation_requires_inputs"
    ],
    "bridgeClaimId": "reciprocity"
  },
  "acquisition_to_control": {
    "id": "acquisition_to_control",
    "targetClaimId": "protect_legitimate_control",
    "title": "为什么资源的取得方式会影响征收理由",
    "summary": "先判断没有欺诈、没有强制的取得是否与参与者的行动和同意相对应。再判断：这种取得方式是否产生一项不应被随意取消的控制主张。",
    "factIds": [
      "voluntary_acquisition_tracks_choice"
    ],
    "bridgeClaimId": "legitimate_control"
  },
  "time_to_future_status": {
    "id": "time_to_future_status",
    "targetClaimId": "account_for_future_harm",
    "title": "为什么出生较晚不能自动降低损失的重要性",
    "summary": "先判断出生时间是否不是本人能够选择的事情。再判断：未来人的重大损失是否不能仅因发生得晚就被赋予更低权重。",
    "factIds": [
      "birth_time_not_action"
    ],
    "bridgeClaimId": "future_equal_weight"
  },
  "information_to_correction": {
    "id": "information_to_correction",
    "targetClaimId": "preserve_error_correction",
    "title": "为什么纠错必须允许错误被发现和传递",
    "summary": "先判断没有被发现和传递的错误是否无法因相关信息而得到修改。再判断：公共制度是否应保留发现、公开和纠正错误的渠道。",
    "factIds": [
      "correction_requires_information"
    ],
    "bridgeClaimId": "error_correction"
  },
  "rules_to_democracy": {
    "id": "rules_to_democracy",
    "targetClaimId": "democratic_authorization",
    "title": "为什么受共同规则约束的人应当参与制定规则",
    "summary": "先判断强制性共同规则是否会改变个人的行动、资源和法律后果。再判断：受这些规则支配的人是否应有大体平等的机会参与制定、审查和撤换规则。",
    "factIds": [
      "common_rules_affect_subjects"
    ],
    "bridgeClaimId": "democratic_authorship"
  },
  "resources_to_nonwaste": {
    "id": "resources_to_nonwaste",
    "targetClaimId": "avoid_ineffective_coercion",
    "title": "为什么明知无效的强制政策不应只因惯性继续",
    "summary": "先判断执行强制政策是否持续消耗人员、时间、系统或财政资源。再判断：不能实现公开目标的强制手段是否不应仅因惯性继续维持。",
    "factIds": [
      "ineffective_policy_uses_resources"
    ],
    "bridgeClaimId": "non_waste"
  },
  "violence_to_cooperation": {
    "id": "violence_to_cooperation",
    "targetClaimId": "preserve_cooperation_conditions",
    "title": "为什么有组织暴力会破坏共同生活的基本条件",
    "summary": "先判断持续的有组织暴力是否会减少流动、交易、公共服务或跨群体合作。再判断：维持不依赖有组织暴力的共同生活，是否是制度必须重视的价值。",
    "factIds": [
      "organized_violence_disrupts_exchange"
    ],
    "bridgeClaimId": "peaceful_cooperation"
  },
  "dependency_to_domination": {
    "id": "dependency_to_domination",
    "targetClaimId": "enable_exit_from_dependency",
    "title": "为什么控制他人的唯一生存来源会形成支配",
    "summary": "先判断切断唯一基本资源来源是否会提高当事人拒绝要求的代价。再判断：任何人是否都不应处在他人可以用这种能力迫使其服从的关系中。",
    "factIds": [
      "dependency_allows_compliance_pressure"
    ],
    "bridgeClaimId": "non_domination"
  },
  "cost_to_control": {
    "id": "cost_to_control",
    "targetClaimId": "prevent_cost_shifting",
    "title": "为什么共同合作反对把可控制的成本全部留给他人",
    "summary": "先判断改变活动规模是否会改变第三方损失。再判断：共同合作是否要求行为者承担由自己可以控制的活动带来的相应成本。",
    "factIds": [
      "controllable_activity_causes_third_party_loss"
    ],
    "bridgeClaimId": "reciprocity"
  }
};

export const policies = [
  {
    "id": "speech_restriction",
    "number": "01",
    "title": "限制严重贬损性表达",
    "shortTitle": "是否用法律禁止严重贬损宗教、民族或国家象征的公开表达",
    "proposition": "通过法律禁止公开发表“严重贬损某个宗教、民族或国家象征”的言论。违法者可能被罚款或拘留。",
    "scope": "题目明确排除直接威胁、针对个人的骚扰、能够查证的虚假事实陈述，以及组织暴力的指令。",
    "supportClaimId": "speech_support",
    "opposeClaimId": "speech_oppose",
    "question": "在这些明确边界下，你目前支持还是反对这项法律？"
  },
  {
    "id": "metadata_surveillance",
    "number": "02",
    "title": "保存全民通信元数据",
    "shortTitle": "是否保存所有成年人的通信时间、联系对象和位置元数据五年",
    "proposition": "保存所有成年人的通信时间、联系双方的标识和位置元数据五年，供安全机关查询。",
    "scope": "不保存通信内容。查询不需要先有针对某个人的嫌疑，也不需要事前取得独立司法批准。",
    "supportClaimId": "surveillance_support",
    "opposeClaimId": "surveillance_oppose",
    "question": "在这些条件下，你目前支持还是反对这项制度？"
  },
  {
    "id": "income_floor",
    "number": "03",
    "title": "无工作条件的普遍现金支付",
    "shortTitle": "是否向每名成年人按月发放基本现金收入",
    "proposition": "每名成年人每月获得一笔现金，金额相当于可支配收入中位数的 15%，不附加工作条件。",
    "scope": "资金来自累进所得税；这笔支付不会取代残障救助和紧急救助。",
    "supportClaimId": "income_support",
    "opposeClaimId": "income_oppose",
    "question": "在这些条件下，你目前支持还是反对这项方案？"
  },
  {
    "id": "carbon_fee",
    "number": "04",
    "title": "碳费与等额返还",
    "shortTitle": "是否对化石燃料中的碳收费，并把净收入平均返还给居民",
    "proposition": "按照化石燃料的含碳量统一收费，费率在十年内逐步提高，净收入按人头等额返还。",
    "scope": "进口商品按同一口径调整；政府每三年公开检查减排效果和不同收入群体的实际负担。",
    "supportClaimId": "carbon_support",
    "opposeClaimId": "carbon_oppose",
    "question": "在这些条件下，你目前支持还是反对这项方案？"
  }
];

export const dilemmas = [
  {
    "id": "agency_vs_security",
    "left": "equal_agency",
    "right": "bodily_security",
    "title": "个人选择与避免重伤发生冲突",
    "scenario": "一项全面禁令每年可以确定多避免 50 起重伤，但它会长期禁止所有成年人一种本身不威胁、不欺诈、也不控制他人的日常选择。没有同样有效而限制更小的办法。",
    "leftAction": "不实行全面禁令，保留成年人不伤害他人的选择",
    "rightAction": "实行全面禁令，每年多避免 50 起重伤",
    "fixedFacts": [
      "全面禁令比替代方案每年多避免 50 起重伤",
      "被禁止的行为本身不直接伤害他人",
      "没有同样有效而限制更小的第三种方案"
    ]
  },
  {
    "id": "domination_vs_security",
    "left": "non_domination",
    "right": "bodily_security",
    "title": "限制任意权力与避免重伤发生冲突",
    "scenario": "安全机关可以秘密定位任何人，而且没有个案标准、使用记录或外部审查。这项权限每年可避免 20 起重伤。加入明确规则和独立审查后，每年只能避免 15 起。",
    "leftAction": "加入规则和独立审查，接受每年少避免 5 起重伤",
    "rightAction": "保留秘密且可单方面使用的权限，每年多避免 5 起重伤",
    "fixedFacts": [
      "两种制度每年避免重伤的差额为 5 起",
      "无审查制度允许机关秘密、单方面使用权限",
      "没有同时保持 20 起效果并加入审查的第三种方案"
    ]
  },
  {
    "id": "floor_vs_control",
    "left": "material_floor",
    "right": "legitimate_control",
    "title": "基本生活条件与资源控制发生冲突",
    "scenario": "对通过没有欺诈、没有强制的方式取得的高额非必需收入征收 2%，可以让五万人不再缺少食物和住所。没有其他办法能在同样时间内筹到相同资金。",
    "leftAction": "征收 2%，让五万人获得最低食物和住所",
    "rightAction": "不征收，保护个人对已取得资源的控制",
    "fixedFacts": [
      "资源取得过程不包含欺诈或强制",
      "征收不会使纳税人低于基本生活条件",
      "不征收会使五万人继续缺少食物和住所"
    ]
  },
  {
    "id": "floor_vs_reciprocity",
    "left": "material_floor",
    "right": "reciprocity",
    "title": "基本生活条件与相称贡献发生冲突",
    "scenario": "一名有工作能力、有岗位机会、也没有照护负担的人，连续五年拒绝任何劳动或社区服务。停止最低现金会使他失去住所；继续支付则由一直贡献的人共同承担。",
    "leftAction": "继续支付最低现金，避免他失去住所",
    "rightAction": "把持续领取与作出相称贡献联系起来",
    "fixedFacts": [
      "他的能力、机会和照护负担已经核实",
      "停止支付会使他失去住所",
      "这笔支付依赖其他人持续贡献"
    ]
  },
  {
    "id": "future_vs_present_floor",
    "left": "future_equal_weight",
    "right": "material_floor",
    "title": "未来人的严重损失与当前基本生活发生冲突",
    "scenario": "立即减排可以在五十年后避免十万人遭受严重损害，但会使今天的一万人在三年内缺少必要能源。没有补偿资金，也没有第三种方案。",
    "leftAction": "立即减排，避免未来十万人的严重损害",
    "rightAction": "延后减排，保证当前一万人的必要能源",
    "fixedFacts": [
      "两类损害使用相同的严重程度标准",
      "未来损害的概率和人数在题目中固定",
      "没有补偿或替代方案"
    ]
  },
  {
    "id": "correction_vs_cooperation",
    "left": "error_correction",
    "right": "peaceful_cooperation",
    "title": "立即纠正公共错误与维持公共服务发生冲突",
    "scenario": "一份证据已经核实的政府失误报告，如果今天公开，会引发大规模但非暴力的抗议，使关键公共服务停摆七天。延迟六个月公开可以避免停摆，但错误会在这六个月里继续影响一万人。",
    "leftAction": "今天公开，让错误立即进入纠正程序",
    "rightAction": "延迟六个月公开，避免公共服务停摆",
    "fixedFacts": [
      "报告中的证据已经核实",
      "抗议不包含有组织暴力",
      "延迟期间错误会继续影响一万人"
    ]
  },
  {
    "id": "procedure_vs_security",
    "left": "procedural_justification",
    "right": "bodily_security",
    "title": "事前申诉程序与紧急安全发生冲突",
    "scenario": "一项限制出境的决定如果等待独立审查，有 30% 的概率来不及阻止一次致命袭击；立即限制可以把这个概率降到 5%，但当事人要等七天才能知道证据并申诉。",
    "leftAction": "先审查再限制，保留事前申诉机会",
    "rightAction": "立即限制，七天后再允许申诉",
    "fixedFacts": [
      "两种方案的袭击风险相差 25 个百分点",
      "独立审查需要七天",
      "事后可以恢复出境资格，但不能恢复已经错过的机会"
    ]
  },
  {
    "id": "democracy_vs_agency",
    "left": "democratic_authorship",
    "right": "equal_agency",
    "title": "民主表决与不伤害他人的个人选择发生冲突",
    "scenario": "一项禁止成年人从事某种没有直接受害者的生活方式的规则，经过事先公开、每人一票、双方信息渠道相同的公投，以 70% 支持率通过，参与率为 90%。",
    "leftAction": "执行公投结果，把共同表决视为一项权威理由",
    "rightAction": "拒绝禁令，保留成年人的个人选择",
    "fixedFacts": [
      "参与率、每票权重、规则公开和信息条件都按题目固定",
      "该行为不含威胁、欺诈或未同意的伤害",
      "规则可以在下一次公投中撤销"
    ]
  },
  {
    "id": "security_vs_democracy",
    "left": "bodily_security",
    "right": "democratic_authorship",
    "title": "避免死亡与遵守公投结果发生冲突",
    "scenario": "一项强制疏散制度每年可以确定避免 100 起死亡，但它在程序公开、每人一票、信息渠道平等、参与率 90% 的公投中被否决。立即执行会违背本次投票；等待重新表决会发生这 100 起死亡。",
    "leftAction": "立即执行疏散制度，避免 100 起死亡",
    "rightAction": "遵守公投结果，等待重新表决",
    "fixedFacts": [
      "死亡数量和因果关系按题目固定",
      "公投程序的条件按题目固定",
      "没有同时避免死亡并遵守本次投票的第三种方案"
    ]
  }
];

export const sources = [
  {
    "id": "hume-treatise",
    "author": "David Hume",
    "year": "1739–1740",
    "title": "A Treatise of Human Nature, Book III, Part I, Section I",
    "role": "最小桥接问题的经典起点：从“事实如此”走到“应该如此”时，新增的规范前提必须被说明。"
  },
  {
    "id": "searle-1964",
    "author": "John R. Searle",
    "year": "1964",
    "title": "How to Derive “Ought” from “Is”",
    "role": "提醒我们检查词语定义和制度规则：有些看似描述性的词已经在定义中包含规范内容。"
  },
  {
    "id": "toulmin-1958",
    "author": "Stephen E. Toulmin",
    "year": "1958",
    "title": "The Uses of Argument",
    "role": "“资料—保证—结论”的结构启发了 F、B、V 的展示方式。"
  },
  {
    "id": "hare-1952",
    "author": "R. M. Hare",
    "year": "1952",
    "title": "The Language of Morals",
    "role": "启发使用事实结构相近的案例，检查一条规范原则是否只在特定政治对象上被接受。"
  },
  {
    "id": "dung-1995",
    "author": "Phan Minh Dung",
    "year": "1995",
    "title": "On the Acceptability of Arguments and its Fundamental Role in Nonmonotonic Reasoning, Logic Programming and n-Person Games",
    "role": "提供支持、反驳和未解决冲突的论证图思路，避免把所有回答压缩为一个分数。"
  },
  {
    "id": "bench-capon-2002",
    "author": "Trevor Bench-Capon",
    "year": "2002",
    "title": "Value Based Argumentation Frameworks",
    "role": "提供价值取舍的形式化思路：同一政策结论可能由不同价值支持，不同价值也可能在具体案例中发生冲突。"
  },
  {
    "id": "cailloux-meinard-2018",
    "author": "Olivier Cailloux, Yves Meinard",
    "year": "2018",
    "title": "A Formal Framework for Deliberated Judgment",
    "role": "支持分别记录用户对结论、论证、反论证和未决理由的态度。"
  },
  {
    "id": "garcia-simari-2004",
    "author": "Alejandro J. García, Guillermo R. Simari",
    "year": "2004",
    "title": "Defeasible Logic Programming: An Argumentative Approach",
    "role": "启发把现实政策理由理解为可以被新证据、例外或更强反对理由推翻的支持，而不是不可更改的严格证明。"
  },
  {
    "id": "walton-krabbe-1995",
    "author": "Douglas N. Walton, Erik C. W. Krabbe",
    "year": "1995",
    "title": "Commitment in Dialogue: Basic Concepts of Interpersonal Reasoning",
    "role": "启发把接受、拒绝、撤回和修订理解为对话中的公开承诺，而不是直接读取内心。"
  },
  {
    "id": "rawls-1951",
    "author": "John Rawls",
    "year": "1951",
    "title": "Outline of a Decision Procedure for Ethics",
    "role": "启发在具体判断、一般原则和反例之间往返修订。"
  },
  {
    "id": "agm-1985",
    "author": "Carlos Alchourrón, Peter Gärdenfors, David Makinson",
    "year": "1985",
    "title": "On the Logic of Theory Change: Partial Meet Contraction and Revision Functions",
    "role": "启发在回答发生冲突时，明确记录修改旧回答、撤回新回答或暂时不判断，而不是自动覆盖旧答案。"
  }
];

applyReadableChinese({ claims, facts, argumentsById, policies, dilemmas });

export const getArgumentsForClaim = (claimId) =>
  Object.values(argumentsById).filter((argument) => argument.targetClaimId === claimId);

export const getPolicy = (policyId) => policies.find((policy) => policy.id === policyId);

export const getTerminalClaims = () => Object.values(claims).filter((claim) => claim.kind === 'terminal');

export const getRelevantDilemmas = (terminalIds) => {
  const set = new Set(terminalIds);
  return dilemmas.filter((item) => set.has(item.left) && set.has(item.right));
};
