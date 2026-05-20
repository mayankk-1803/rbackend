/**
 * Recharge Plan Normalizer Service
 * Converts raw provider plan data into a clean, standardized, categorized structure.
 * Automatically generates a smart "popular" category based on pricing and validity.
 */

export const normalizeRechargePlans = (rawPlans, operatorObj, circleObj) => {
  const categorized = {
    popular: [],
    unlimited: [],
    data: [],
    talktime: [],
    annual: []
  };

  if (!Array.isArray(rawPlans) || rawPlans.length === 0) {
    return {
      success: true,
      operator: operatorObj || { name: "Unknown", code: 0 },
      circle: circleObj || { name: "Delhi NCR", code: 5 },
      plans: categorized
    };
  }

  // Set of popular price points across Indian telecom operators
  const popularAmounts = new Set([197, 260, 299, 397, 479, 666, 719, 749]);

  rawPlans.forEach((plan) => {
    // Extract and normalize common fields from various provider API structures (PlanAPI, MPlan, local)
    const amount = Number(plan.amount || plan.rs || plan.price || plan.Amount || 0);
    const validity = plan.validity || plan.Validity || plan.val || "Existing Pack";
    const data = plan.data || plan.Data || plan.data_benefit || "N/A";
    const description = plan.description || plan.Description || plan.desc || plan.detail || "";
    const ott = plan.ott || plan.OTT || plan.ott_benefit || (description.toLowerCase().includes("hotstar") ? "Disney+ Hotstar" : description.toLowerCase().includes("prime") ? "Prime Video" : description.toLowerCase().includes("sonyliv") ? "SonyLIV" : "None");
    const calls = plan.calls || plan.Calls || plan.call_benefit || (description.toLowerCase().includes("unlimited") ? "Truly Unlimited" : "As per plan");

    const cleanPlan = {
      amount,
      validity,
      data,
      ottBenefits: ott,
      unlimitedCalls: calls,
      description
    };

    if (amount <= 0) return;

    // Determine category
    const descLower = description.toLowerCase();
    const valLower = validity.toLowerCase();

    let assignedCategory = "unlimited";

    if (plan.category) {
      const catLower = plan.category.toLowerCase();
      if (catLower.includes("data")) assignedCategory = "data";
      else if (catLower.includes("talktime") || catLower.includes("topup") || catLower.includes("voucher")) assignedCategory = "talktime";
      else if (catLower.includes("annual") || valLower.includes("365") || valLower.includes("300") || valLower.includes("year")) assignedCategory = "annual";
      else if (catLower.includes("popular")) assignedCategory = "popular";
      else assignedCategory = "unlimited";
    } else {
      // Smart categorization fallback
      if (valLower.includes("365") || valLower.includes("300") || valLower.includes("year")) {
        assignedCategory = "annual";
      } else if (descLower.includes("data") && !descLower.includes("unlimited calls") && (amount < 150 || valLower.includes("existing"))) {
        assignedCategory = "data";
      } else if (descLower.includes("talktime") || descLower.includes("topup") || (amount < 150 && !descLower.includes("unlimited"))) {
        assignedCategory = "talktime";
      } else {
        assignedCategory = "unlimited";
      }
    }

    // Push to appropriate category
    if (assignedCategory === "annual") categorized.annual.push(cleanPlan);
    else if (assignedCategory === "data") categorized.data.push(cleanPlan);
    else if (assignedCategory === "talktime") categorized.talktime.push(cleanPlan);
    else if (assignedCategory === "popular") categorized.popular.push(cleanPlan);
    else categorized.unlimited.push(cleanPlan);

    // Smart Popular Plan Auto-Generation: if it matches popular amounts and isn't already in popular
    if (popularAmounts.has(amount) && assignedCategory !== "popular") {
      // Check if already in popular to avoid duplicates
      if (!categorized.popular.some(p => p.amount === amount)) {
        categorized.popular.push(cleanPlan);
      }
    }
  });

  // If popular is still empty, pick top 3 from unlimited
  if (categorized.popular.length === 0 && categorized.unlimited.length > 0) {
    categorized.popular = categorized.unlimited.slice(0, 3);
  }

  // Sort each category by amount ascending
  Object.keys(categorized).forEach((key) => {
    categorized[key].sort((a, b) => a.amount - b.amount);
  });

  return {
    success: true,
    operator: operatorObj || { name: "Unknown", code: 0 },
    circle: circleObj || { name: "Delhi NCR", code: 5 },
    plans: categorized
  };
};
