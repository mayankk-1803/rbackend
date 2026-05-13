import axios from "axios";

export const testGetBalance = async () => {
  const apiToken = process.env.APIBOX_TOKEN;
  const baseUrl = process.env.APIBOX_BASE_URL || "https://Apibox.co.in/Api/Service";
  
  if (!apiToken) {
    throw new Error("APIBOX_TOKEN is not defined in environment variables");
  }

  // Apibox balance check endpoint
  const url = `${baseUrl}/Balance?ApiToken=${apiToken}`;
  
  const response = await axios.get(url);
  return response.data;
};
