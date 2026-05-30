export const REAL_TO_ALIAS = {
  APIBOX: "Primary Gateway",
  MPLAN: "Plans Engine",
  EZYTM: "Operator Engine"
};

export const ALIAS_TO_REAL = {
  PRIMARY_RECHARGE: "APIBOX",
  PLAN_ENGINE: "MPLAN",
  OPERATOR_ENGINE: "EZYTM",
  "PRIMARY GATEWAY": "APIBOX",
  "PLANS ENGINE": "MPLAN",
  "OPERATOR ENGINE": "EZYTM"
};

export const PROVIDER_TYPES = {
  APIBOX: "RECHARGE",
  MPLAN: "PLAN_FETCH",
  EZYTM: "OPERATOR_LOOKUP"
};

export const mapProviderToAlias = (provider) => {
  if (!provider) return provider;
  const code = provider.code?.toUpperCase();
  const aliasCode = REAL_TO_ALIAS[code];
  if (aliasCode) {
    return {
      ...provider,
      code: aliasCode,
      name: aliasCode,
      providerType: PROVIDER_TYPES[code] || null
    };
  }
  return provider;
};

export const mapAliasToReal = (body) => {
  if (!body) return body;
  const data = { ...body };
  if (data.code) {
    const realCode = ALIAS_TO_REAL[data.code.toUpperCase()];
    if (realCode) {
      data.code = realCode;
    }
  }
  if (data.name) {
    const realCode = ALIAS_TO_REAL[data.name.toUpperCase()];
    if (realCode) {
      data.name = realCode;
    }
  }
  return data;
};

export default {
  REAL_TO_ALIAS,
  ALIAS_TO_REAL,
  PROVIDER_TYPES,
  mapProviderToAlias,
  mapAliasToReal
};
