/**
 * Conservative migration from 0.9 sessions to the current v4 decision model.
 *
 * The old session cannot be reinterpreted as an active v4 result because:
 * - "conditional" was a primitive stance rather than a derived frame comparison;
 * - component answers were attached to the original whole-policy claim;
 * - no immutable accepted policy frame was stored;
 * - local objection targets were not identified.
 *
 * Therefore this migration preserves the old material as a read-only archive and
 * starts a clean v4 questionnaire. It never fabricates a policy frame.
 */

const clone = (value) => structuredClone(value);

export const migrateLegacySessionV09 = (legacyState, modelV4) => {
  const records = legacyState?.records && typeof legacyState.records === 'object'
    ? legacyState.records
    : {};

  const archivedPolicies = Object.entries(records).map(([policyId, record]) => ({
    policyId,
    oldStance: record?.stance ?? null,
    oldDirection: record?.direction ?? null,
    oldStatus: record?.status ?? null,
    oldPolicyChoiceResponses: clone(record?.policyChoiceResponses || {}),
    oldSafeguardResponses: clone(record?.safeguardResponses || {}),
    oldParameterResponses: clone(record?.parameterResponses || {}),
    oldChains: clone(record?.chains || []),
    reason: 'The old record does not identify a complete accepted policy frame under schema v4.',
  }));

  return {
    modelVersion: modelV4.meta.version,
    storageVersion: 10,
    phase: 'landing',
    policyResults: {},
    currentPolicyId: null,
    currentNodeId: null,
    history: [],
    migrationNotice: archivedPolicies.length
      ? '旧版回答已保留为只读记录。由于旧版“有条件支持”和组件回答不能可靠转换成完整政策变体，请重新回答相关政策。'
      : null,
    legacyArchive: {
      sourceModelVersion: legacyState?.modelVersion || '0.9.x',
      importedAt: new Date().toISOString(),
      policies: archivedPolicies,
      conflicts: clone(legacyState?.conflicts || []),
      modelGaps: clone(legacyState?.modelGaps || []),
      dilemmaResponses: clone(legacyState?.dilemmaResponses || {}),
      snapshot: clone(legacyState || {}),
    },
  };
};

export const canPromoteLegacyRecord = () => false;
