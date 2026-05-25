async function test() {
  try {
    const res = await fetch("http://localhost:5000/api/imart/products");
    const data = await res.json();
    console.log("Success:", data.success);
    console.log("Data count:", data.data?.length);
    if (data.data && data.data.length > 0) {
      console.log("First product sample:", {
        id: data.data[0].id,
        name: data.data[0].name,
        category: data.data[0].category,
        images: data.data[0].images,
      });
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
test();
