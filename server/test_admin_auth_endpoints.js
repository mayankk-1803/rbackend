import axios from "axios";

async function run() {
  console.log("=== SIMULATING ADMIN CATALOG REQUESTS ===");
  try {
    // 1. Log in
    const loginRes = await axios.post("http://localhost:5000/api/auth/login", {
      email: "admin@dizipay.com",
      password: "123456"
    }, {
      headers: { "x-admin-request": "true" }
    });

    const token = loginRes.data?.data?.token || loginRes.data?.token;
    console.log("✔ Login successful. Token obtained:", token ? "YES" : "NO");

    if (!token) {
      console.error("Login failed:", loginRes.data);
      return;
    }

    // 2. Fetch Slabs
    console.log("\n[FETCH slabs]");
    try {
      const slabsRes = await axios.get("http://localhost:5000/api/admin/commission/slabs?limit=100", {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Status:", slabsRes.status);
      console.log("Body length/slabs count:", slabsRes.data?.data?.slabs?.length);
    } catch (err) {
      console.error("Failed:", err.response?.status, err.response?.data);
    }

    // 3. Fetch Operators
    console.log("\n[FETCH operators]");
    try {
      const opsRes = await axios.get("http://localhost:5000/api/admin/commission/operators", {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Status:", opsRes.status);
      console.log("Body length/operators count:", opsRes.data?.data?.length);
    } catch (err) {
      console.error("Failed:", err.response?.status, err.response?.data);
    }

    // 4. Fetch Service Categories
    console.log("\n[FETCH service-categories]");
    try {
      const catsRes = await axios.get("http://localhost:5000/api/admin/commission/service-categories", {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Status:", catsRes.status);
      console.log("Body length/categories count:", catsRes.data?.data?.length);
    } catch (err) {
      console.error("Failed:", err.response?.status, err.response?.data);
    }

    // 5. Fetch Commission Roles
    console.log("\n[FETCH commission-roles]");
    try {
      const rolesRes = await axios.get("http://localhost:5000/api/admin/commission/commission-roles", {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Status:", rolesRes.status);
      console.log("Body length/roles count:", rolesRes.data?.data?.length);
    } catch (err) {
      console.error("Failed:", err.response?.status, err.response?.data);
    }

  } catch (err) {
    console.error("Error running test:", err.message, err.response?.data);
  }
}

run();
