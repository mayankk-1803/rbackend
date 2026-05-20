import { normalizeOperator, getProviderOperatorCode } from "../src/config/operators.js";

function testMapping() {
  console.log("Testing current operator mapping functions...");
  const inputs = ["5", "JIO", "1", "AIRTEL", "VI", "2"];
  
  for (const input of inputs) {
    const norm = normalizeOperator(input);
    const code = getProviderOperatorCode(norm);
    console.log(`Input: ${input} | Normalized: ${norm} | Provider Operator Code: ${code}`);
  }
}

testMapping();
