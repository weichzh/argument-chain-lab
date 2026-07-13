const claimOverrides = {
  speech_support: {
    text: '国家应该通过这项法律，禁止公开严重贬损特定宗教、民族或国家象征的表达。',
    explanation: '这是本轮需要说明的政策结论 V。系统不会仅凭你支持它，就推断你接受某一种价值观。',
  },
  speech_oppose: {
    text: '国家不应该通过这项法律来禁止公开严重贬损特定宗教、民族或国家象征的表达。',
    explanation: '这是本轮需要说明的政策结论 V。反对同一政策也可能出于不同理由，系统会继续追问。',
  },
  surveillance_support: {
    text: '国家应该要求保存所有成年人的通信元数据五年，并允许安全机关按题设方式查询。',
    explanation: '这里的“元数据”只包括通信时间、双方标识和位置等信息，不包括通信内容。',
  },
  surveillance_oppose: {
    text: '国家不应该要求保存所有成年人的通信元数据五年，也不应该允许安全机关按题设方式查询。',
    explanation: '这里的“元数据”只包括通信时间、双方标识和位置等信息，不包括通信内容。',
  },
  income_support: {
    text: '国家应该向每名成年人发放一笔不附带工作条件的基本现金，并按题设方式筹资。',
    explanation: '这是一项政策结论。支持它可能来自减轻匮乏、减少支配或其他不同理由。',
  },
  income_oppose: {
    text: '国家不应该向每名成年人发放这笔不附带工作条件的基本现金。',
    explanation: '这是一项政策结论。反对它可能来自财产控制、互惠、长期成本或其他不同理由。',
  },
  carbon_support: {
    text: '国家应该按化石燃料的含碳量收费，并把净收入平均返还给每个人。',
    explanation: '这是本轮需要说明的政策结论 V。系统会把减排效果、分配影响和价值原则分开询问。',
  },
  carbon_oppose: {
    text: '国家不应该按题设方案征收碳费并平均返还收入。',
    explanation: '反对当前方案不等于否认气候变化，也可能只是反对其效果、分配或执行方式。',
  },

  prevent_severe_harm: {
    shortLabel: '没有较温和替代时，应预防死亡和重伤',
    text: '如果一项措施能够明显减少死亡或重伤，而且没有同样有效、但对个人限制更小的替代办法，那么国家至少有一项理由采用这项措施。',
    explanation: '事实部分只说“措施能减少严重伤害，而且没有同效的较温和办法”。桥接原则另外加入了一个价值判断：这样的事实会给国家行动提供理由。',
    example: '例如，某项交通规则确实能明显减少致命事故，又没有同样有效的更温和办法。接受这条原则的人会认为，这至少支持采用该规则；但它仍可能被成本、程序或其他价值反驳。',
  },
  protect_nonharmful_choice: {
    shortLabel: '不直接伤害他人的选择，原则上由本人决定',
    text: '如果一个成年人的行为不威胁、骚扰、欺骗或控制他人，也不直接损害他人的身体和财产，那么国家至少有一项理由保持克制，不用刑罚、普遍监控或其他强制手段大幅限制这种行为及其正常交往。',
    explanation: '这条原则不是说所有个人选择都不能受限制。它只处理题设已排除威胁、欺诈、骚扰和未同意伤害的情况。',
    example: '例如，一个成年人选择一种多数人不喜欢、但不伤害他人的生活方式。接受这条原则的人会认为，多数人的反感本身不足以支持刑罚。',
  },
  constrain_discretionary_power: {
    shortLabel: '没有明确规则和独立监督的公权力，应受到限制',
    text: '如果公权力可以在没有明确规则、公开理由和独立审查的情况下，选择性地干预个人，那么国家至少有一项理由取消这种权力，或给它加上严格限制。',
    explanation: '这里关注的不只是权力有没有被滥用，还关注它是否能够被随意使用。',
    example: '例如，一个机关可以秘密查询任何人的记录，却不用说明原因，也没有独立机构复核。即使目前没有发现滥用，这条原则仍会支持限制该权限。',
  },
  equal_public_participation: {
    shortLabel: '制度造成可以避免的公共参与障碍时，应当修正',
    text: '如果一种本可避免的制度安排，长期使某些公民更难进入公共机构、使用公共服务或参与公共决策，那么国家至少有一项理由修正这种安排。',
    explanation: '这条原则不要求每个人得到完全相同的结果。它要求制度不要持续制造与公共参与有关、而且可以避免的障碍。',
    example: '例如，所有听证会都安排在某个群体长期无法进入的场所。即使法律没有明文排斥他们，制度仍可能需要调整。',
  },
  review_high_cost_coercion: {
    shortLabel: '可能造成重大误伤的强制决定，必须允许复核',
    text: '如果国家要对个人施加罚款、拘留、限制出境等强制措施，而决定所依据的事实可能判断错误，并且错误会造成重大损失，那么国家至少有一项理由设置及时、独立、允许当事人申辩的审查程序。',
    explanation: '它把“判断可能出错且误伤代价很大”连接到“必须有复核和申诉”。',
    example: '例如，系统可能把无辜者误判为高风险对象，并因此冻结账户。接受这条原则的人会要求当事人能看到理由、提交反证并得到独立复核。',
  },
  secure_material_capacity: {
    shortLabel: '制度应尽量避免人失去基本生活条件',
    text: '如果一项社会可以负担的措施能明显减少人们缺少食物、住房、必要能源或基本医疗的情况，而且不会造成更多同样严重的匮乏，国家至少有一项理由采用它。反过来，若一项政策会让人失去这些基本条件且没有充分补偿，国家至少有一项理由修改或放弃它。',
    explanation: '这条原则只给基本生活条件以规范分量，并不预先指定必须采用现金、公共服务或其他某一种工具。',
    example: '例如，一项方案能让大量家庭不再缺少食物和住所，同时没有制造更大规模的同类匮乏。这条原则会给方案提供一项支持理由。',
  },
  require_reciprocal_contribution: {
    shortLabel: '有能力且从共同制度受益的人，应承担相称贡献',
    text: '如果一项共同制度必须依靠成员持续贡献才能维持，而某个人与其他贡献者有相近的能力和机会，却长期拒绝作出任何贡献，那么制度至少有一项理由要求他承担相称的负担。',
    explanation: '这里的关键条件是能力、机会和已有负担相近。照护劳动、疾病或缺少机会都可能构成相关区别。',
    example: '例如，两个人同样受益、能力和机会也相近；一人长期贡献，另一人可以贡献却始终拒绝。这条原则会支持向后者提出贡献要求。',
  },
  protect_legitimate_control: {
    shortLabel: '正当取得的资源，不应被随意拿走',
    text: '如果一个人通过没有欺诈、没有强迫的生产或交换取得资源，那么国家要征收这些资源，至少需要比“多数人更喜欢这样”更充分的理由。',
    explanation: '这不是绝对所有权原则。它只说取得方式会产生一项需要认真对待的控制主张。',
    example: '例如，某人通过自愿交换获得一笔收入。即使征收能满足多数人的偏好，接受这条原则的人仍会要求说明更强的公共理由。',
  },
  account_for_future_harm: {
    shortLabel: '未来发生的严重损失，也必须算在内',
    text: '如果今天的行动会在可以估计的未来，增加他人死亡、重伤、失去基本生活条件或遭受重大财产损失的概率，那么决策不能仅仅因为这些损失发生得较晚，就把它们忽略。',
    explanation: '这条原则不否认概率、机会成本和时间差可能影响权衡。它只否认“发生得晚”本身足以把重大损失排除在外。',
    example: '例如，今天得到一点便利，会在五十年后明显增加严重伤害。接受这条原则的人会要求把未来损失纳入同一决策。',
  },
  preserve_error_correction: {
    shortLabel: '制度必须保留发现并纠正错误的渠道',
    text: '如果禁止某类不含威胁的表达，会明显减少可核实错误被发现、公开和纠正的机会，那么国家至少有一项理由不实施这项禁令。',
    explanation: '这里的价值判断是：让公共错误能够被看见和修正，本身值得制度保护。',
    example: '例如，一项表达禁令同时压低了有证据的腐败报道，而没有其他举报渠道补上缺口。这条原则会支持反对禁令。',
  },
  democratic_authorization: {
    shortLabel: '公开而平等的民主程序，本身会给政策增加一项支持理由',
    text: '如果一项强制政策通过公开程序制定，受影响者拥有大体平等的参与机会，而且政策以后还能被审查和撤换，那么这套程序本身至少会给政策增加一项支持理由。',
    explanation: '它不是说多数决定一定正确，也不是说民主程序能压倒所有个人权利。它只把共同参与视为一项独立理由。',
    example: '例如，一项规则经过公开讨论、平等投票并可在以后撤销。即使规则内容仍有争议，这个程序本身也可能给它增加一些正当性。',
  },
  avoid_ineffective_coercion: {
    shortLabel: '强制政策长期无效时，不应只因惯性继续',
    text: '如果可靠证据显示，一项强制政策不能实现它公开宣称的目标，而且还持续消耗大量人员、时间或财政资源，那么国家至少有一项理由停止或不采用这项政策。',
    explanation: '这里不是说所有效果较小的政策都必须取消，而是针对目标已经明确落空、资源仍在持续投入的情况。',
    example: '例如，一项政策多年没有改变目标指标，可靠评估也预测继续执行不会改善结果。接受这条原则的人会认为，机构惯性不足以支持继续。',
  },
  preserve_cooperation_conditions: {
    shortLabel: '制度应保护人们在没有组织性暴力的情况下共同生活',
    text: '如果一种可以避免的行为模式，会明显提高组织性暴力或公共制度崩溃的概率，而且限制这种行为不会造成更大的同类风险，那么国家至少有一项理由限制它。',
    explanation: '这里保护的是和平合作的基本条件，不是让执政者免受反对、批评或非暴力抗议。',
    example: '例如，某类行动能够独立预测随后发生的组织性暴力，而较小限制不足以降低风险。这条原则会给限制提供一项理由。',
  },
  enable_exit_from_dependency: {
    shortLabel: '人不应因基本生存受控而被迫服从',
    text: '如果一种制度安排让一方能够通过切断食物、住所或必要医疗，迫使另一方服从，那么国家至少有一项理由为后者提供真正可用的退出选择。',
    explanation: '重点不是一般意义上的依赖，而是某一方能够用基本生存资源作为服从工具。',
    example: '例如，雇主或伴侣控制当事人唯一的住所和医疗来源，并以切断资源迫使其接受要求。稳定的替代收入可能构成退出选项。',
  },
  prevent_cost_shifting: {
    shortLabel: '可控制的活动，不应把损失单方面留给旁人',
    text: '如果一项活动会增加没有同意承担风险的第三方所遭受的身体或财产损失，而且活动者能够改变活动规模，那么制度至少有一项理由要求活动者承担相应成本。',
    explanation: '这条原则把可控制的因果影响和负担分配联系起来，但不等于只要造成损失就有罪或应受惩罚。',
    example: '例如，某种排放会增加周边居民的健康和财产损失，而排放者可以减少排放。接受这条原则的人会支持让排放者承担部分成本。',
  },

  respect_personal_authorship: {
    shortLabel: '主要影响本人生活的选择，应尽量留给本人',
    text: '如果一项选择主要改变行为者自己的生活，而且不直接控制他人的身体、财产或同等选择空间，那么制度至少有一项理由把决定留给本人，而不是替他作决定。',
    explanation: '这条原则比“个人喜欢什么就一定可以”更窄。它要求先排除对他人的直接控制和未同意损害。',
    example: '例如，一个成年人选择职业、服饰或生活方式，主要后果由本人承担，也不妨碍他人的同等选择。这里会产生把决定留给本人的理由。',
  },
  protect_agency_preconditions: {
    shortLabel: '制度应保护人作出并执行选择所需的最低能力',
    text: '如果一种本可避免的制度安排，会让人失去形成、修改或执行生活计划所必需的最低身体或物质能力，而且修正它不会让别人失去同等程度的能力，那么制度至少有一项理由修正这种安排。',
    explanation: '它不是直接保护某个具体偏好，而是保护人能够作出和执行选择所需要的最低条件。',
    example: '例如，一个人因缺少必要医疗而完全无法工作、迁居或照顾自己。改善这一条件可能被视为恢复其行动能力。',
  },
  equal_standing_under_coercion: {
    shortLabel: '国家强制个人时，应让当事人知道理由、提出质疑',
    text: '如果国家要强制改变某人的行动、资源或法律资格，那么制度至少有一项理由让当事人知道决定依据、提出质疑，并让相关证据有机会改变决定。',
    explanation: '“把当事人当作理由主体”在这里不是抽象称赞，而是三个具体要求：知道理由、能提出反证、反证能被考虑。',
    example: '例如，一个人被限制出境。接受这条原则的人会要求他知道依据，并能提交证据由独立机构复核。',
  },
  require_answerable_power: {
    shortLabel: '能够改变个人基本处境的公权力，必须给理由并接受复核',
    text: '如果公权力能够单方面改变个人的重要选择、资格或资源，而当事人不能及时知道理由，也不能申请独立复核，那么制度至少有一项理由用公开规则、理由说明和独立审查来限制这种权力。',
    explanation: '这条原则把“权力影响很大”与“权力必须能够回答质疑”连接起来。',
    example: '例如，机关可以秘密冻结账户，又无需告知证据。接受这条原则的人会要求公开规则和独立复核。',
  },
  preserve_institutional_learning: {
    shortLabel: '制度要长期可靠，就必须能够发现错误并据此修改',
    text: '如果一个制度只有在能够发现、传递和改正错误时，才可能长期可靠，那么制度至少有一项理由保留让错误被看见、并能触发修改的渠道；除非这些渠道会造成更大的同类损失。',
    explanation: '这条原则关注的不只是言论本身，而是制度是否有信息回路来发现失败并修订规则。',
    example: '例如，政策结果从不记录，也没有人能把失败信息送到决策者手中，制度就无法根据实际效果学习。',
  },
  assign_burdens_to_controllers: {
    shortLabel: '谁能控制造成损失的活动，谁就更有理由承担相应负担',
    text: '如果某个人能够控制自己的活动，而这项活动会增加没有同意承担风险的第三方所遭受的身体或财产损失，那么制度至少有一项理由让能够改变活动的人承担相应负担，而不是把损失全部留给第三方。',
    explanation: '它强调的是“谁能够改变风险来源”，并不直接等同于道德责备或刑罚。',
    example: '例如，企业能够通过设备升级减少污染，而污染损失落在周边居民身上。这条原则会支持把部分治理成本交给企业。',
  },

  equal_agency: {
    shortLabel: '每个人都应平等决定自己的无害生活选择',
    text: '只要一个人能够形成和修改自己的生活计划，他就和其他人一样，应当能够自己决定那些不伤害他人的个人选择，而不是由别人代替。',
    explanation: '这是一个可能的基础价值。它强调每个人对自己生活的平等决定资格，而不是说所有行为都不受限制。',
    example: '例如，多数人认为某种生活方式低俗或无益，但它不威胁、欺骗或伤害他人。接受这条价值的人会认为，多数人的反感不足以替当事人作决定。',
    stressTest: {
      scenario: '一名成年人选择一种多数人认为低俗、无益，但不威胁、不欺骗、也不控制他人的生活方式。禁止它只会让多数人感觉更舒服，不会减少可测量的身体或财产损失。',
      question: '换成这个对象后，你还接受“无害的个人选择应由本人决定”吗？',
      distinctions: ['当事人不是能够独立决定的成年人', '行为其实造成了未经同意的伤害', '这项选择剥夺了他人的同等选择空间'],
    },
  },
  non_domination: {
    shortLabel: '任何人都不应受制于他人不受约束的权力',
    text: '任何人都不应处在这样一种关系中：别人可以随意干预他的基本选择，却不用遵守明确规则，也不用给出能够被质疑的理由。',
    explanation: '重点不是权力已经造成多少干预，而是某个人是否掌握一种可以随时使用、又不必回答质疑的控制能力。',
    example: '例如，管理者可以随时查看员工私人通信，既没有规则，也没有日志和外部审查。即使他承诺不会滥用，这种权力结构本身仍可能成问题。',
    stressTest: {
      scenario: '一位管理者承诺不会滥用随时查看员工私人通信的权限，过去也没有查阅记录。但这项权限没有明确规则、没有使用日志，也没有外部审查。',
      question: '即使管理者目前很克制，你仍认为这项不受约束的权限应被限制吗？',
      distinctions: ['员工可以无成本、无报复风险地撤回同意', '权限必须由多人共同决定才能启动', '每次使用都会自动接受独立审查'],
    },
  },
  bodily_security: {
    shortLabel: '避免死亡和重伤具有很高的价值分量',
    text: '避免人的死亡、重伤和严重身体损害，是制度必须给予很高重视的一项理由。',
    explanation: '这是一项价值承诺，不是对某项政策效果的事实判断。某项政策是否真的减少伤害，仍要另行判断。',
    example: '例如，一项措施能避免重伤。接受这项价值，只表示“避免重伤”会支持措施；并不表示措施一定应实施。',
    stressTest: {
      scenario: '一项措施能够确定避免少量重伤，但会长期限制所有成年人的一项日常选择，而且没有完全无代价的替代办法。',
      question: '在这个案例中，“避免重伤”是否仍至少算作支持该措施的一项理由？',
      distinctions: ['风险由当事人充分知情并自愿承担', '措施本身会造成同等程度的身体损害', '存在同样有效、限制更小的替代办法'],
    },
  },
  equal_civic_status: {
    shortLabel: '所有公民都应有平等参与公共生活的资格',
    text: '公共制度应把每个公民都当作具有同等资格的参与者，而不应把某些人长期放在较低等级的位置。',
    explanation: '这不要求所有人得到完全相同的结果，但要求制度不能系统地把某些人排除在参与、申诉或担任公职之外。',
    example: '例如，一个群体在纸面上有投票权，但所有听证会都安排在他们无法进入的地方。形式权利相同，不等于实际参与资格相同。',
    stressTest: {
      scenario: '一个群体依法拥有投票权，但所有公共听证会长期只在该群体成员无法进入的场所举行。没有人公开宣布要排斥他们。',
      question: '即使法律文字对所有人相同，你仍认为制度需要修正这种安排吗？',
      distinctions: ['进入差异完全来自个人可以控制的选择', '调整会剥夺另一群体的同等参与机会', '差异只发生一次，而且事前无法预见'],
    },
  },
  procedural_justification: {
    shortLabel: '国家强制个人时，必须给理由并允许申诉',
    text: '国家对个人施加强制时，应向当事人说明决定依据，并提供能够由独立机构审查、允许当事人质疑的程序。',
    explanation: '它认为程序是否允许申辩，本身就重要，而不能只看官员最后有没有判断正确。',
    example: '例如，一个人被秘密限制出境，即使官员通常判断准确，当事人仍可能有理由要求知道证据并申诉。',
    stressTest: {
      scenario: '一位判断几乎从不出错的官员，可以秘密决定谁被限制出境。决定通常能预防真实风险，但当事人既不知道证据，也不能申诉。',
      question: '即使官员准确率很高，你仍认为当事人应当获得理由和独立审查吗？',
      distinctions: ['即时危险使事前审查在时间上完全不可能', '事后审查能够完整恢复全部损失', '公开证据会直接暴露具体受害者'],
    },
  },
  material_floor: {
    shortLabel: '任何人都不应因可避免的匮乏而失去基本生活',
    text: '任何人都不应因为本可避免的资源匮乏，而失去维持生存、身体健康和最低限度实际选择所需要的食物、住所、能源或医疗。',
    explanation: '这是对基本生活条件的价值判断，不等于任何具体福利方案都有效或没有代价。',
    example: '例如，一个人即将失去食物和住所。接受这项价值的人会认为，避免这种最低生活能力的崩溃本身构成一项理由。',
    stressTest: {
      scenario: '一个人因为连续作出高风险选择而失去食物和住所。提供最低救助不会补偿他的全部损失，也不会阻止以后追究责任。',
      question: '即使匮乏和他的选择有关，你仍认为最低救助有一项独立理由吗？',
      distinctions: ['救助会立即让其他人陷入同等严重的匮乏', '当事人拒绝所有不会增加风险的可行替代', '资源总量不足以同时维持所有人的最低生活'],
    },
  },
  reciprocity: {
    shortLabel: '从共同制度受益且有能力的人，应承担相称贡献',
    text: '在必须依靠共同负担才能维持的制度中，能力和机会相近的人，应承担大致相称的贡献责任。',
    explanation: '这项价值允许疾病、照护劳动、缺少机会和既有负担构成相关差别，不要求每个人机械地付出完全相同。',
    example: '例如，两个人同样从公共制度受益，能力和机会也相近；一人持续贡献，另一人能够贡献却始终拒绝。这里会出现互惠问题。',
    stressTest: {
      scenario: '两个人从同一公共制度获得相同收益，能力和机会也相近。一人持续贡献，另一人能够贡献却始终拒绝。',
      question: '在这些条件下，制度是否有理由要求后者作出相称贡献？',
      distinctions: ['他未被记录的照护劳动已经构成贡献', '制度收益并不是由共同贡献维持的', '退出制度真实可行，而且不会把成本留给其他人'],
    },
  },
  legitimate_control: {
    shortLabel: '个人对正当取得的资源拥有需要被尊重的控制主张',
    text: '一个人通过没有欺诈、没有强迫的方式取得资源后，他对这些资源的控制，不应被国家或他人随意取消。',
    explanation: '这不是绝对财产权。它只说正当取得会产生一项反对随意征收或剥夺的理由。',
    example: '例如，一个人通过自愿交换积累了收入。即使征收能满足多数人的偏好，他对这笔资源仍可能保有一项需要权衡的控制主张。',
    stressTest: {
      scenario: '某人通过自愿交换积累了大量非必需资源。征收其中一小部分，只用于多数人偏好的公共装饰项目，不会改变任何人的食物、住所、身体状态或法律资格。',
      question: '在这个案例中，正当取得仍然构成一项反对征收的理由吗？',
      distinctions: ['取得过程包含没有补偿的第三方损失', '控制该资源本身阻断了他人的同等资格', '既有公开规则已经明确约定这项负担'],
    },
  },
  future_equal_weight: {
    shortLabel: '不能只因一个人出生较晚，就轻视他的重大损失',
    text: '仅仅因为一些人出生得较晚，不能因此把他们可以预见的死亡、重伤或其他重大损失看得更轻。',
    explanation: '它允许概率、不确定性和机会成本影响判断，但否认“出生时间”本身会降低一个人的地位。',
    example: '例如，今天的一点便利会在五十年后确定造成严重伤害。接受这项价值的人会要求把未来受害者按同样的地位纳入考虑。',
    stressTest: {
      scenario: '今天获得一项小幅便利，会在五十年后确定使另一群人遭受严重身体损害；两代人的人数相同。',
      question: '你仍认为未来这群人的损失必须被认真纳入同一权衡吗？',
      distinctions: ['未来损害概率极低而且无法可靠估计', '延迟行动会让当前人遭受同等严重的损害', '未来人拥有更容易、成本更低的规避办法'],
    },
  },
  error_correction: {
    shortLabel: '公共制度必须保留发现、公开和纠正错误的能力',
    text: '公共制度应保留发现、公开和纠正错误的渠道，即使这些渠道会带来不适、冒犯或短期冲突。',
    explanation: '这项价值不自动压倒直接威胁、欺诈或隐私伤害。它只确认公共纠错能力本身具有分量。',
    example: '例如，一份有充分证据的调查会让机构短期失去信任，但隐瞒会让已知错误继续。这里会出现公开与维持表面稳定的冲突。',
    stressTest: {
      scenario: '一份证据充分的调查，会让一个广受尊敬的机构短期失去信任；如果不公开，已经确认的错误会继续存在。',
      question: '在这个案例中，公共纠错是否仍支持公开调查结果？',
      distinctions: ['公开会直接暴露具体无辜者的身份', '证据还没有达到可核实的程度', '可以稍后公开，而且等待不会让错误扩大'],
    },
  },
  democratic_authorship: {
    shortLabel: '受共同规则约束的人，应有平等机会参与制定和撤换规则',
    text: '受到共同规则约束的人，应有真正而且大体平等的机会，参与制定、审查和撤换这些规则。',
    explanation: '这项价值重视人们作为共同规则参与者的地位，但不把任何多数决定都当作正确。',
    example: '例如，一项规则经过公开讨论、平等投票并可被以后撤销。即使规则内容有问题，参与结构本身仍可能提供一项理由。',
    stressTest: {
      scenario: '一项规则经过事前公开、每人一票并有充分参与的投票通过，但它禁止少数人的一种不伤害他人的生活方式。',
      question: '即使这条规则可能侵犯其他价值，民主程序本身是否仍给它增加了一项理由？',
      distinctions: ['少数人实际上被排除在程序之外', '议题涉及不能由多数取消的平等资格', '投票信息受到系统性伪造'],
    },
  },
  non_waste: {
    shortLabel: '制度不应只因惯性继续明知无效的强制政策',
    text: '当可靠证据已经表明一种强制手段无法实现公开目标，而且它还持续占用本可用于其他目标的资源时，制度不应只因为惯性而继续维持它。',
    explanation: '这项价值反对手段和目标已经脱节后，仍继续使用强制和资源。',
    example: '例如，一项政策多年没有改善目标指标，可靠评估也预测继续无效。机构不愿承认过去错误，并不是继续强制的充分理由。',
    stressTest: {
      scenario: '一项政策连续多年没有改变目标指标，可信评估也预测继续执行不会改善结果，但取消政策会迫使机构承认过去判断错误。',
      question: '在这个案例中，政策无效和持续耗费资源是否仍构成停止它的理由？',
      distinctions: ['公开指标遗漏了真实但暂时无法测量的效果', '停止会造成更高的过渡损失', '政策还承担另一个已经公开说明的目标'],
    },
  },
  peaceful_cooperation: {
    shortLabel: '制度应保护人们不靠组织性暴力也能共同生活',
    text: '制度必须重视这样一种社会条件：互不相识、意见不同的人，仍能在不诉诸组织性暴力的情况下共同生活、交易和使用公共服务。',
    explanation: '这不是要求服从秩序，也不是保护执政者免受批评。关键是避免组织性暴力破坏共同生活的基本条件。',
    example: '非暴力抗议可能带来冲突和不便，但仍不同于组织性暴力。只有后者真正威胁到这里所说的合作条件。',
    stressTest: {
      scenario: '公开一项真实信息会引发短期大规模抗议，但抗议者没有组织暴力计划，公共机构仍能继续运作。',
      question: '在这个案例中，“维护和平合作”是否足以支持压制这项真实信息？',
      distinctions: ['已经存在可以核实的组织暴力计划', '公共服务会立即中断并造成严重身体损害', '限制只延迟很短时间，而且保留独立复核'],
    },
  },
};

const factStatements = {
  speech_scope_noncoercive: '这项法律只处理公开的严重贬低或侮辱性表达。直接威胁、针对个人的骚扰、能够核实为假的事实陈述，以及指挥组织暴力的内容，都不在本题范围内。',
  speech_reduces_serious_assaults: '在其他条件相近的地区，这项法律实施后，针对特定群体的重伤案件连续三年平均减少了至少20%。研究把同一时期警力和治安预算的变化分开计算后，仍然得到这个结果。',
  speech_no_equal_alternative: '在相同研究条件下，增加反暴力执法、加强受害者保护和支持反向表达的组合方案，减少重伤案件的幅度仍低于这项禁令。',
  speech_participation_gap_reduced: '这项法律实施后，原先经常受到贬低或侮辱的群体，在参加公开听证、使用公共服务和报名公职方面，与其他群体的差距连续三年缩小。',
  speech_preexisting_participation_barrier: '在法律实施前，经常受到贬低或侮辱的群体，参加公开听证、使用公共服务和报名公职的比例长期较低。研究把收入、教育、年龄和地区差异分开计算后，这个差距仍然存在；接触这类表达越多的人，参与差距也越大。',
  speech_enforcement_variance: '面对内容相同的表达，不同执法单位会因为说话者身份不同，而给出明显不同的立案概率。',
  speech_open_standard_no_review: '法律只写了“严重贬低或侮辱”，没有列出足够明确的判断标准。立案机关不必公开具体理由，立案前也没有独立机构复核。',
  speech_blocks_verified_reporting: '这项法律实施后，包含可核实腐败或机构失误证据的报道变少；其他举报渠道增加的已核实披露，不足以补上这个缺口。',
  speech_organized_violence_link: '题目所说的这类表达出现后，随后七天内发生组织性暴力动员的概率会上升。研究把已知动员网络的影响分开计算后，这种关系仍然存在。',
  speech_restriction_no_greater_cooperation_risk: '按同一套事件标准、同一段时间比较，这项法律新引发的组织性暴力和关键公共服务中断，没有多于它所减少的同类事件。',

  surveillance_scope: '制度保存所有成年人的通信时间、联系对象和位置记录，保存期为五年。查询前不需要先证明某个人有具体嫌疑，也不需要事前得到独立法院批准。',
  surveillance_prevents_attacks: '这项制度使已经开始准备、接近实施的致命袭击，每年减少至少15%。研究把同一时期情报预算增加的影响分开计算后，仍然得到这个结果。',
  surveillance_no_equal_targeted_method: '在预算相同的条件下，只保存有具体嫌疑对象的数据，并加快司法授权，减少袭击的效果仍低于全民保存制度。',
  surveillance_no_greater_cooperation_risk: '按同一套事件标准、同一段时间比较，全民保存制度新引发的组织性暴力和公共服务中断，没有多于它所避免的袭击原本会造成的同类事件。',
  surveillance_audit_public: '这项制度通过公开立法建立。成年人有大体平等的投票和代表机会；每次查询都会自动留下记录，年度统计公开，议会也可以废除制度。但具体查询仍不需要事前独立批准。',
  surveillance_false_positive_cost: '由系统标记引发的限制出境、冻结账户或拘留中，至少5%最后被确认找错了人，而且大多数损失无法完全恢复。',
  surveillance_chills_association: '制度实施后，没有被指控违法的记者、律师和政治团体，与消息来源的通信变少；减少的主要是那些能从通信时间、联系对象和位置记录中识别出来的联系。',
  surveillance_discretionary_queries: '执行机关可以查询任何成年人的记录，不必公开针对这个人的理由，也不必事先取得独立批准。',

  income_program_scope: '每名成年人每月领取一笔不附带工作条件的现金。金额等于税后可支配收入中间数的15%；这里的“中间数”是把所有人的收入从低到高排列后，位于正中间的数。资金来自收入越高、适用税率越高的所得税，而且不会取代残障救助和紧急救助。',
  income_reduces_deprivation: '方案实施三年后，无法稳定获得食物、住所或必要药物的人口比例至少下降了25%。',
  income_no_larger_same_loss: '把税收负担和人们可能改变行为的影响都算进去后，确实有一部分人会因方案而新陷入食物、住所或必要药物匮乏；但这部分人数少于因方案而摆脱同类匮乏的人数。',
  income_reduces_caseworker_discretion: '基本现金只根据年龄和居住记录自动发放。个案工作人员不能依据含义模糊的评价标准拒绝发放。',
  income_status_quo_gatekeeping: '现有基础救助允许个案工作人员用没有完整定义的“求职诚意”或“家庭支持”等标准拒绝发放，而且拒绝前没有独立复核。',
  income_exit_abuse: '方案实施后，曾遭遇工资扣留、工作场所暴力或伴侣暴力的人，离开相关雇佣或伴侣关系的比例上升。',
  income_dependency_control: '在部分受助者中，雇主或伴侣控制着当事人获得食物、住所或必要医疗的唯一来源，并能通过切断这些资源，提高当事人拒绝要求的代价。',
  income_financed_from_voluntary_holdings: '新增税款来自劳动报酬、投资收益和自愿交易所得。本题假定这些收入不是靠欺诈或强迫取得的。',
  income_noncontributors: '部分领取者与持续贡献者有相近的劳动能力、工作机会和照护负担，但连续五年没有从事有偿劳动、照护、学习或社区服务。',
  income_program_requires_contributions: '这项现金支付只有在税收持续流入时才能维持。如果税收下降，而其他条件不变，支付总额就会下降，或者转化为债务。',
  income_future_burden: '如果方案保持不变，未来二十年增加的净债务会通过更高税率或削减基础服务，使后续人口中至少与当前受益人数相当的一部分人，无法稳定获得食物、住所、必要能源或必要医疗。',

  carbon_program_scope: '方案根据煤、石油和天然气燃烧后会产生多少碳排放来收费，费率在十年内逐步提高。扣除管理成本后的收入平均返还给每个人；进口商品按同一标准处理，政府每三年公开检查一次实际效果。',
  carbon_reduces_damage: '与不实施政策相比，这项方案在十年内使累计温室气体排放至少减少15%。研究模型同时显示，由这些排放造成的死亡、重伤和财产损失也会减少。',
  carbon_no_equal_alternative: '在财政成本相同、执行时间同为十年的条件下，已经评估过的其他政策组合——也就是不靠碳排放收费的方案——累计减排量都低于这项方案。',
  carbon_future_loss: '不采取政策会提高未来二十年至八十年间，人们遭受高温相关死亡、洪水损失和粮食减产的概率。',
  carbon_external_costs: '化石燃料造成的碳排放增加时，没有参与相关生产或交易的人，会承担更多可以估计的身体或财产损失；排放者也能够改变自己的排放量。',
  carbon_bottom_decile_loss: '即使把现金返还算进去，在收入最低的10%家庭中，仍有至少十分之一在方案实施后的前三年，无法同时支付最低食物、住所、必要医疗，以及维持就业所需的能源和交通费用。',
  carbon_leakage: '部分企业把生产转移到没有这项收费的地区，国内商品也被高排放的进口商品替代。这些变化抵消了境内减排的80%以上，因此全球累计排放几乎没有下降。',
  carbon_tracking_discretion: '主管机关可以用不公开的计算模型，调整用来估算企业排放量的系数，并在复核完成前先追缴费用；企业看不到模型采用了哪些参数。',

  severe_harm_removes_options: '死亡会结束一个人之后的全部行动；重伤通常会减少他实际能够做出的选择和行动。',
  criminal_penalty_reduces_options: '罚款、拘留或刑事记录会改变一个人可支配的资源、可采取的行动或未来机会。',
  unchecked_power_changes_dependence: '当一方可以单方面干预另一方，又不用说明理由时，后者的选择会受到前者是否使用这项能力的影响。',
  participation_is_membership_mechanism: '投票、参加听证、提出申诉和担任公职，都是公民影响共同规则和公共机构运作的具体方式。',
  decision_makers_are_fallible: '个人和机构在证据不完整时作出的判断，有时会被后来出现的证据推翻。',
  deprivation_reduces_capacity: '缺少食物、住所或必要医疗，会降低人的存活机会、健康状况，或减少他实际能够完成的行动。',
  cooperation_requires_inputs: '有些公共制度只有持续得到劳动、税款或照护投入，才能维持原有服务数量。',
  voluntary_acquisition_tracks_choice: '在没有欺诈和强迫的生产或交换中，资源转移是参与者根据自己的行动和同意完成的。',
  birth_time_not_action: '一个人出生在什么时间，不是他在出生前能够选择或改变的事情。',
  correction_requires_information: '如果一个错误从未被发现，或者发现后没有告知能够修改它的人，那么制度就不会根据这个错误作出纠正。',
  common_rules_affect_subjects: '强制性的共同规则会改变受规则约束者可以做什么、拥有多少资源，或会承担什么法律后果。',
  ineffective_policy_uses_resources: '执行一项强制政策，至少需要人员、时间、信息系统或财政支出中的一种资源。',
  organized_violence_disrupts_exchange: '持续的组织性暴力会减少人员流动、交易、公共服务运行或不同群体之间的合作，至少影响其中一项。',
  dependency_allows_compliance_pressure: '当一方能够切断另一方获得食物、住所或必要医疗的唯一来源时，这项能力会提高后者拒绝要求所要付出的代价。',
  controllable_activity_causes_third_party_loss: '如果改变一项可控制活动的规模，会随之改变第三方遭受的身体或财产损失，那么两者之间存在可以通过干预改变的因果关系。',
  personal_choice_locates_primary_consequences: '在已经排除威胁、欺诈、针对个人的骚扰，以及未经同意的身体或财产影响后，一个成年人是否采用某种生活方式，主要改变的是他本人的行动安排和生活计划。',
  agency_requires_minimum_capabilities: '一个人如果死亡、长期失去意识，或者无法获得维持生存所需的食物、住所和必要医疗，他能够形成并实际执行的生活计划会变少。',
  contestability_changes_decision_input: '当事人如果能看到决定理由、提交反证，并得到独立机构复核，他提供的信息就有可能改变决定；如果这些渠道都不存在，他的信息就无法通过这些渠道影响决定。',
  unreviewable_power_blocks_counterevidence: '如果公权力不告诉当事人个案决定依据，也没有独立复核，当事人掌握的反证就无法进入这套复核程序并改变决定。',
  policy_revision_requires_performance_signals: '一个制度要根据执行结果修改政策，至少需要记录结果、把结果和目标比较，再把比较信息传给能够修改政策的人。',
};

const factExplanationOverrides = {
  speech_scope_noncoercive: '这里只是在划定题目边界：本题讨论的是冒犯或贬损性的公开表达，不讨论威胁、骚扰、造谣或组织暴力。这样可以避免把几种性质不同的表达混在一起。',
  speech_reduces_serious_assaults: '这句话只问一个效果问题：法律实施以后，针对相关群体的重伤案件是否真的明显减少，而且减少不能只是因为同期增加了治安投入。',
  speech_no_equal_alternative: '这句话比较禁令和较温和方案的实际效果。它不是说替代方案毫无作用，而是说在相同研究条件下，替代方案减少重伤的幅度更小。',
  speech_participation_gap_reduced: '这句话只问法律实施后，原先受贬损群体参与公共生活的实际差距是否持续缩小。它没有直接判断这种结果是否足以支持禁令。',
  speech_preexisting_participation_barrier: '这句话在问：法律实施前是否已经存在稳定的参与障碍，而且这种障碍与接触贬损表达的程度有关，不能只用收入、教育、年龄或地区差异解释。',
  speech_enforcement_variance: '这句话只问执法是否存在身份差别：表达内容和情境相同，仅仅更换说话者身份，立案概率是否也会改变。',
  speech_open_standard_no_review: '这是题目直接规定的制度条件：法律标准较模糊，机关不用公开个案理由，立案前也没有独立复核。三项条件需要分别看清。',
  speech_blocks_verified_reporting: '这句话只问禁令是否同时压低了有证据的腐败或失误报道，而且其他举报渠道没有补回这些经过核实的信息。',
  speech_organized_violence_link: '这句话问的是可检验的预测关系：这类表达出现后，七天内的组织性暴力动员是否更可能发生，而且不能只由已有动员网络解释。',
  speech_restriction_no_greater_cooperation_risk: '这句话比较两类后果：法律新造成的组织性暴力或公共服务中断，是否少于它所减少的同类事件。',

  surveillance_scope: '这里只是在说明制度覆盖谁、保存什么、保存多久，以及查询需要什么条件。它本身不判断全民保存是否正当。',
  surveillance_prevents_attacks: '这句话只问全民保存制度是否确实减少了已经进入实施阶段的致命袭击，而且这个效果不能只归因于情报预算增加。',
  surveillance_no_equal_targeted_method: '这句话比较两种办法：定向保存加快速司法批准，是否能在相同预算下达到全民保存制度的防袭击效果。',
  surveillance_no_greater_cooperation_risk: '这句话比较制度造成和避免的同类严重后果，不是在笼统地问制度“利大于弊”。',
  surveillance_audit_public: '这是题目固定的一组程序条件：制度公开立法、查询留痕、年度统计公开并可由议会废除，但个案查询没有事前独立批准。',
  surveillance_false_positive_cost: '这句话只问两件事：系统标记是否会以不低的比例找错人，以及限制出境、冻结账户或拘留造成的损失是否通常难以完全恢复。',
  surveillance_chills_association: '这句话问的是合法联系是否因为通信时间、联系对象和位置记录被长期保存而减少，尤其是记者、律师和政治团体与消息来源之间的通信。',
  surveillance_discretionary_queries: '这是题目直接规定的权限范围：机关可以查询任何成年人的记录，不必先说明针对这个人的理由，也不必事前取得独立批准。',

  income_program_scope: '这里只是在固定方案内容：谁领取、领取多少、是否附带工作条件、如何筹资，以及哪些原有救助继续保留。',
  income_reduces_deprivation: '这句话只问方案实施后，缺少食物、住所或必要药物的人口比例是否确实大幅下降。',
  income_no_larger_same_loss: '这句话把方案减少的基本生活匮乏，与税收或行为变化新造成的同类匮乏放在同一口径下比较。',
  income_reduces_caseworker_discretion: '这是题目固定的发放规则：基础现金只看年龄和居住记录，个案工作人员不能用含义模糊的态度评价拒绝发放。',
  income_status_quo_gatekeeping: '这是题目对现行救助的设定：工作人员可以使用边界不清的标准拒绝申请，而且拒绝前没有独立复核。',
  income_exit_abuse: '这句话只问稳定现金到账后，遭遇扣薪或暴力的人是否更有可能离开相关雇佣或伴侣关系。',
  income_dependency_control: '这句话问的是一种具体控制关系：雇主或伴侣是否掌握当事人唯一的基本生活来源，并能用切断资源提高拒绝要求的代价。',
  income_financed_from_voluntary_holdings: '这是题目对税源取得方式的限定：相关收入来自劳动、投资或自愿交易，题目没有设定其中存在欺诈或强迫。',
  income_noncontributors: '这句话只描述一个特定群体：他们与贡献者的能力、机会和照护负担相近，却连续多年没有从事题目列出的任何贡献活动。',
  income_program_requires_contributions: '这句话只说明预算关系：现金支付不能凭空持续，必须依靠税收、借款或其他持续投入。',
  income_future_burden: '这句话问的是长期财政后果：现有方案不调整时，新增债务是否会通过税收或服务削减，使以后的人失去基本生活条件。',

  carbon_program_scope: '这里只是在固定碳费方案的收费方式、提高速度、返还方式、进口处理和复核周期。',
  carbon_reduces_damage: '这句话只问方案是否真的减少累计排放，并进一步减少由气候变化造成的死亡、重伤或财产损失。',
  carbon_no_equal_alternative: '这句话比较的是已经评估过的替代政策。在财政成本和时间相同的条件下，它们是否能达到同样的累计减排量。',
  carbon_future_loss: '这句话只问不采取政策是否会提高未来人遭受高温死亡、洪水损失和粮食减产的概率。损失应不应该被重视，要另问规范原则。',
  carbon_external_costs: '这句话只描述排放与第三方损失之间的关系：排放增加是否会增加旁人的身体或财产损失，以及排放者是否能够改变排放量。',
  carbon_bottom_decile_loss: '这句话只问现金返还以后，最低收入家庭中是否仍有一部分人无法同时支付题目列出的必要生活和就业支出。',
  carbon_leakage: '这句话只问境内减排是否被生产转移和进口替代大幅抵消，以至于全球累计排放几乎没有下降。',
  carbon_tracking_discretion: '这是题目固定的执行条件：机关可以使用企业看不到的模型调整系数，并在独立复核完成前先追缴费用。',

  severe_harm_removes_options: '这句话只描述死亡和重伤对行动能力的影响：死亡终止以后的一切行动，重伤通常会减少一个人实际能做的事情。',
  criminal_penalty_reduces_options: '这句话只描述刑罚或刑事记录会怎样改变一个人的资源、行动范围和未来机会，不判断这种改变是否正当。',
  unchecked_power_changes_dependence: '这句话只描述一种权力关系：当一方可以随时干预且不用说明理由，另一方的选择就会受到这项能力本身的影响。',
  participation_is_membership_mechanism: '这句话只说明公民通过哪些具体渠道影响共同规则和公共机构，不判断这些渠道应当如何分配。',
  decision_makers_are_fallible: '这句话只说个人和机构可能判断错误，而且后来出现的新证据有时会推翻原判断。',
  deprivation_reduces_capacity: '这句话只描述基本生活匮乏对生存、健康和实际行动能力的影响，不直接推出国家应采取哪种救助政策。',
  cooperation_requires_inputs: '这句话只说明某些公共制度必须持续获得劳动、税款或照护投入，才能维持原有服务。',
  voluntary_acquisition_tracks_choice: '这句话只描述没有欺诈和强迫时，资源转移通常来自参与者自己的行动和同意。它还没有说明由此产生多强的财产权。',
  birth_time_not_action: '这句话只说明一个人的出生时间不是他本人能够事先选择或改变的事情。',
  correction_requires_information: '这句话只说明纠错需要信息：如果错误从未被发现，也没有传给能够修改它的人，制度就不会据此纠正错误。',
  common_rules_affect_subjects: '这句话只描述强制性共同规则会实际改变受规则者的行动、资源或法律后果。',
  ineffective_policy_uses_resources: '这句话只说明执行任何强制政策都要占用至少一种现实资源，即使政策最后没有达到目标。',
  organized_violence_disrupts_exchange: '这句话只描述持续的组织性暴力会怎样妨碍人员流动、交易、公共服务或群体合作。',
  dependency_allows_compliance_pressure: '这句话只描述控制唯一生存来源会产生什么后果：被控制者拒绝要求时会付出更高代价。',
  controllable_activity_causes_third_party_loss: '这句话只问损失是否能够通过改变活动规模而改变。若能改变，就说明活动与第三方损失之间存在可干预的因果关系。',
  personal_choice_locates_primary_consequences: '这句话已经排除威胁、欺诈、骚扰和未经同意的伤害，只问剩余生活方式的主要后果是不是落在行为者本人身上。',
  agency_requires_minimum_capabilities: '这句话只描述行动能力的最低条件：死亡、长期失去意识或缺少维持生存的基本资源，会减少人能够形成和执行的生活计划。',
  contestability_changes_decision_input: '这句话只比较两种程序：有理由说明、反证和独立复核时，当事人的信息可能改变决定；没有这些渠道时，信息无法通过该程序发挥作用。',
  unreviewable_power_blocks_counterevidence: '这句话只说明：如果机关既不告知决定依据，也不提供独立复核，当事人的反证就没有正式渠道进入并改变决定。',
  policy_revision_requires_performance_signals: '这句话只说明制度要根据结果改进政策，至少需要记录结果、与目标比较，并把信息交给有权修改政策的人。',
};

const policyOverrides = {
  speech_restriction: {
    title: '是否用法律处罚严重贬低或侮辱性的公开表达',
    shortTitle: '是否处罚严重贬低宗教、民族或国家象征的公开表达',
    proposition: '拟议法律规定：公开表达如果被认定为“严重贬低或侮辱某一宗教、民族或国家象征”，表达者可以被罚款或拘留。',
    scope: '本题明确排除四类内容：直接威胁、针对个人的骚扰、能够核实为假的事实陈述，以及指挥组织暴力的内容。请只判断剩下的严重贬低或侮辱性表达。',
    question: '在这些边界都固定的情况下，你目前倾向支持还是反对这项法律？',
  },
  metadata_surveillance: {
    title: '是否保存所有成年人的通信时间、联系对象和位置记录',
    shortTitle: '是否保存所有成年人的通信记录五年',
    proposition: '拟议制度要求通信服务商保存所有成年人的通信时间、联系对象和位置记录，保存期为五年，供安全机关查询。通信内容本身不保存。',
    scope: '安全机关查询时不需要先证明某个人有具体嫌疑，也不需要事前取得独立法院批准。',
    question: '在这些条件下，你目前倾向支持还是反对这项制度？',
  },
  income_floor: {
    title: '是否每月向每名成年人发放一笔不附带工作条件的现金',
    shortTitle: '是否发放不附带工作条件的基本现金',
    proposition: '拟议方案向每名成年人每月发放一笔现金，领取不附带工作条件。金额等于税后可支配收入中间数的15%：把所有人的收入从低到高排列，取正中间的数，再取其中的15%。',
    scope: '资金来自累进所得税，也就是收入越高，适用税率越高；残障救助和紧急救助继续保留，不会被这笔现金取代。',
    question: '在这些条件下，你目前倾向支持还是反对这项方案？',
  },
  carbon_fee: {
    title: '是否按化石燃料造成的碳排放收费，并平均返还收入',
    shortTitle: '是否按碳排放收费并平均返还收入',
    proposition: '拟议方案根据煤、石油和天然气燃烧后会产生多少碳排放来收费，费率在十年内逐步提高；扣除管理成本后的收入，平均返还给每个人。',
    scope: '进口商品按相同标准调整；政府每三年公开检查减排效果和不同收入群体的实际得失。',
    question: '在这些条件下，你目前倾向支持还是反对这项方案？',
  },
};

const dilemmaOverrides = {
  agency_vs_security: {
    title: '个人的无害选择，还是避免更多重伤',
    scenario: '一项全面禁令每年可以确定避免60起重伤，但它会长期禁止所有成年人一种不威胁、不欺骗、也不控制他人的日常选择。较温和的替代办法每年最多避免10起重伤。',
    leftAction: '不实施全面禁令，保留成年人这项无害选择',
    rightAction: '实施全面禁令，每年多避免50起重伤',
    fixedFacts: ['全面禁令与较温和方案相比，每年多避免50起重伤', '被禁止的行为本身不直接伤害他人', '没有同样有效而限制更小的第三种方案'],
  },
  domination_vs_security: {
    title: '限制不受监督的权力，还是避免更多重伤',
    scenario: '安全机关可以秘密定位任何人。过去五年，这项权限每年避免20起重伤，但没有明确个案标准、使用日志或外部审查。加入这些约束后，每年只能避免15起重伤。',
    leftAction: '加入明确规则、日志和独立审查，接受每年少避免5起重伤',
    rightAction: '保留秘密而单方面的权限，每年多避免5起重伤',
    fixedFacts: ['两种制度每年避免重伤的差额为5起', '现行权限可以单方面秘密使用', '不存在效果相同又能同时避免两项代价的第三种方案'],
  },
  floor_vs_control: {
    title: '保障基本生活，还是保护正当取得的财产控制',
    scenario: '对通过没有欺诈、没有强迫方式取得的高额非必需收入征收2%，可以让五万人不再缺少食物和住所。没有其他办法能在同样时间内筹到相同资金。',
    leftAction: '征收2%，让五万人获得食物和住所',
    rightAction: '不征收，保护个人对正当取得收入的控制',
    fixedFacts: ['收入取得过程没有欺诈或强迫', '征收不会让纳税人跌破基本生活线', '如果不征收，五万人会继续缺少食物和住所'],
  },
  floor_vs_reciprocity: {
    title: '继续保障最低生活，还是要求有能力者作出贡献',
    scenario: '一个人有工作能力、有现实岗位机会，也没有照护负担，但连续五年拒绝任何劳动或社区服务。停止最低现金会让他失去住所；继续支付则由持续贡献的人共同负担。',
    leftAction: '继续支付最低现金，避免他失去住所',
    rightAction: '把持续支付与相称贡献挂钩',
    fixedFacts: ['他的能力、机会和照护负担已经核实', '停止支付会让他失去住所', '继续支付依赖其他人持续贡献'],
  },
  future_vs_present_floor: {
    title: '避免未来严重伤害，还是维持当前基本能源',
    scenario: '立即减排会在五十年后避免十万人遭受严重损害，但会让今天一万人在三年内缺少必要能源。没有补偿资金，也没有第三种方案。',
    leftAction: '立即减排，避免未来十万人的严重损害',
    rightAction: '延后减排，维持当前一万人的必要能源',
    fixedFacts: ['两类损害使用同一严重程度标准', '未来损害的人数和概率在题目中固定', '没有补偿或替代方案'],
  },
  correction_vs_cooperation: {
    title: '立即公开错误，还是避免公共服务短期停摆',
    scenario: '一份证据充分的政府失误报告，如果今天公开，会引发大规模但非暴力的抗议，使关键公共服务停摆七天。延迟六个月公开可以避免停摆，但错误会在这六个月继续影响一万人。',
    leftAction: '今天公开，让错误立即进入纠正程序',
    rightAction: '延迟六个月公开，避免七天服务停摆',
    fixedFacts: ['报告证据已经核实', '抗议不包含组织性暴力', '延迟期间错误会继续影响一万人'],
  },
  procedure_vs_security: {
    title: '先让当事人申辩，还是先处理紧急危险',
    scenario: '一项限制出境决定如果等待独立审查，有30%的概率来不及阻止一次致命袭击；立即限制可以把概率降到5%，但当事人要到七天后才能看到证据并申诉。',
    leftAction: '先审查再限制，保留事前申辩程序',
    rightAction: '立即限制，七天后再提供理由和审查',
    fixedFacts: ['两种做法的致命袭击风险相差25个百分点', '事后审查固定在七天后', '事后可以恢复资格，但无法恢复已经失去的机会'],
  },
  democracy_vs_agency: {
    title: '服从公平公投，还是保留成年人的无害选择',
    scenario: '一项规则禁止成年人从事某种没有直接受害者的生活方式。公投参与率为90%，每人一票，规则事前公开，支持和反对双方拥有同等信息渠道，最后70%赞成禁令。',
    leftAction: '执行公投结果，把共同决定作为一项权威理由',
    rightAction: '拒绝禁令，保留成年人的无害选择',
    fixedFacts: ['公投参与、选票权重、规则公开和信息渠道条件都按题设固定', '该生活方式不包含威胁、欺诈或未经同意的伤害', '规则可以在下一次公投中撤销'],
  },
  security_vs_democracy: {
    title: '立即避免100起死亡，还是遵守公投否决',
    scenario: '一项强制疏散制度每年可以确定避免100起死亡，但一场参与充分、每人一票、信息公开的公投否决了它。立即执行会直接违背投票结果；等待重新表决会发生这100起死亡。',
    leftAction: '立即执行疏散制度，避免100起死亡',
    rightAction: '遵守本次公投结果，等待重新表决',
    fixedFacts: ['死亡数量和因果关系按题设固定', '公投程序满足题设中的公平条件', '不存在既避免死亡又遵守本次投票结果的第三种方案'],
  },
};

const argumentTitleOverrides = {
  speech_harm_support: '因为禁令确实能减少针对群体的重伤',
  speech_participation_support: '因为禁令能减少某些群体参与公共生活的障碍',
  speech_cooperation_support: '因为这类表达会增加组织性暴力动员',
  speech_choice_oppose: '因为法律处罚的是没有直接伤害他人的表达',
  speech_discretion_oppose: '因为模糊标准会让执法机关选择性处理不同说话者',
  speech_correction_oppose: '因为禁令会压低有证据的公共错误披露',
  surveillance_harm_support: '因为全民保存能减少已经开始准备、接近实施的致命袭击',
  surveillance_demo_support: '因为制度经过公开立法、留痕并可被撤销',
  surveillance_cooperation_support: '因为制度能减少破坏公共服务的组织性袭击',
  surveillance_power_oppose: '因为机关可以在没有事前独立批准时查询任何人',
  surveillance_procedure_oppose: '因为系统误判会造成难以恢复的强制损失',
  surveillance_association_oppose: '因为全民保存会压低记者、律师和政治团体的合法联系',
  income_material_support: '因为方案能明显减少食物、住所和药物匮乏',
  income_discretion_support: '因为自动发放会减少个案人员随意拒绝救助的权力',
  income_exit_support: '因为稳定现金会提高人们离开暴力或扣薪关系的能力',
  income_holdings_oppose: '因为新增税收来自没有欺诈或强迫取得的收入',
  income_reciprocity_oppose: '因为存在有能力、有机会却长期不作贡献的领取者',
  income_future_oppose: '因为长期债务会把基本生活损失转移给以后的人',
  carbon_harm_support: '因为方案能减少排放以及相关的身体和财产损失',
  carbon_future_support: '因为不行动会增加未来人的重大损失',
  carbon_cost_support: '因为排放者能控制一项会把损失留给第三方的活动',
  carbon_material_oppose: '因为返还后仍有低收入家庭无法支付必要支出',
  carbon_effectiveness_oppose: '因为生产转移会抵消大部分全球减排效果',
  carbon_power_oppose: '因为主管机关能用不公开的模型先追缴、后复核',
  choice_to_authorship: '因为无害的生活选择主要改变的是本人生活',
  authorship_to_equal_agency: '因为个人选择构成了他自己的生活计划',
  severe_harm_to_agency_preconditions: '因为死亡和重伤会破坏作出选择所需的能力',
  deprivation_to_agency_preconditions: '因为基本物质匮乏会破坏执行生活计划的能力',
  agency_preconditions_to_equal_agency: '因为平等决定自己生活，需要最低身体和物质能力',
  discretion_to_answerability: '因为不受约束的单方权力既制造依赖，也阻断质疑',
  fallibility_to_answerability: '因为可能出错的强制决定需要让反证进入',
  answerability_to_equal_standing: '因为不给理由和复核，会让当事人的反证无法进入决定',
  standing_to_procedure: '因为申辩和独立复核能让当事人的信息影响决定',
  information_to_institutional_learning: '因为错误必须被发现并传递，制度才可能修改',
  learning_to_error_correction: '因为制度根据结果修订政策，需要完整的信息回路',
  cost_to_controller_burden: '因为改变活动规模会改变第三方遭受的损失',
  controller_burden_to_reciprocity: '因为一方可控制的活动把共同成本留给了未同意者',
  severe_harm_to_security: '因为死亡和重伤会大幅减少人的行动能力',
  choice_to_agency: '因为刑罚会直接替代当事人的无害选择',
  discretion_to_domination: '因为不受约束的干预能力会让人受制于他人意志',
  participation_to_status: '因为参与渠道决定谁能影响共同规则',
  fallibility_to_procedure: '因为强制决定可能被后来的证据推翻',
  deprivation_to_floor: '因为匮乏会损害生存、健康和实际行动能力',
  inputs_to_reciprocity: '因为共同制度只有得到持续投入才能维持',
  acquisition_to_control: '因为没有欺诈和强迫的取得过程记录了行动与同意',
  time_to_future_status: '因为出生时间不是任何人自己选择的',
  information_to_correction: '因为没有被发现和传递的错误无法得到纠正',
  rules_to_democracy: '因为共同规则会改变所有受约束者的行动和后果',
  resources_to_nonwaste: '因为即使政策无效，强制执行仍会持续消耗资源',
  violence_to_cooperation: '因为组织性暴力会中断流动、交易和公共服务',
  dependency_to_domination: '因为控制唯一生存来源会提高拒绝要求的代价',
  cost_to_control: '因为活动者可以改变一项会增加第三方损失的活动',
};

function addPlainFactGuidance(item) {
  if (item.kind === 'stipulated') {
    item.plainExplanation = '这是题目为了让不同价值可以被比较而固定的条件。它只说明本题设定了什么，不包含“好不好”或“应不应该”。';
    item.plainTruthConditions = '查看题目或制度文本：这句话列出的条件必须全部存在。';
    item.plainFalsifier = '只要其中任何一项条件与题设不符，这句话就不成立。';
  } else if (item.kind === 'empirical') {
    item.plainExplanation = '这是一个可以被现实证据支持或推翻的经验判断。即使它为真，也不能单独推出政策应该通过或反对。';
    item.plainTruthConditions = '需要有质量足够的研究或数据支持这个结果；比较对象应当足够相似，而且主要的其他原因已经被排除或单独计算。';
    item.plainFalsifier = '如果更可靠的研究没有发现这个结果、发现了相反结果，或者主要变化其实由其他原因造成，这句话就不成立。';
  } else {
    item.plainExplanation = '这是一个关于事物如何发生或概念之间如何关联的描述。它不包含“应当”“有理由”等价值判断。';
    item.plainTruthConditions = '按题目给出的定义和观察方式，确实能看到这句话描述的关系。';
    item.plainFalsifier = '如果按同样定义观察不到这种关系，或能观察到相反关系，这句话就不成立。';
  }
}

export function applyReadableChinese({ claims, facts, argumentsById, policies, dilemmas }) {
  Object.entries(claimOverrides).forEach(([id, override]) => {
    if (!claims[id]) return;
    const { stressTest, ...rest } = override;
    Object.assign(claims[id], rest);
    if (stressTest) claims[id].stressTest = { ...claims[id].stressTest, ...stressTest };
  });

  Object.entries(factStatements).forEach(([id, statement]) => {
    if (facts[id]) facts[id].statement = statement;
  });
  Object.values(facts).forEach(addPlainFactGuidance);
  Object.entries(factExplanationOverrides).forEach(([id, explanation]) => {
    if (facts[id]) facts[id].plainExplanation = explanation;
  });

  Object.entries(policyOverrides).forEach(([id, override]) => {
    const policy = policies.find((item) => item.id === id);
    if (policy) Object.assign(policy, override);
  });

  Object.entries(dilemmaOverrides).forEach(([id, override]) => {
    const dilemma = dilemmas.find((item) => item.id === id);
    if (dilemma) Object.assign(dilemma, override);
  });

  Object.values(argumentsById).forEach((argument) => {
    if (argumentTitleOverrides[argument.id]) argument.title = argumentTitleOverrides[argument.id];
    const target = claims[argument.targetClaimId];
    const bridge = claims[argument.bridgeClaimId];
    const factList = argument.factIds.map((id) => facts[id]?.statement).filter(Boolean);
    const factCountText = factList.length === 1 ? '1 项事实判断' : `${factList.length} 项事实判断`;
    argument.summary = `这条理由分成两步：先检查 ${factCountText}，再判断你是否接受规范原则“${bridge?.shortLabel || bridge?.text}”。系统会在后面的页面逐项解释和提问；现在只需要判断，这是不是你实际采用的理由。`;
    argument.plainSteps = {
      facts: factList,
      bridgeLabel: bridge?.shortLabel || '',
      bridgeText: bridge?.text || '',
      targetText: target?.text || '',
    };
  });
}
