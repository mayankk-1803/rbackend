/**
 * Simple CSV Export Helper.
 */
export const convertToCSV = (data, fields) => {
  if (!data || data.length === 0) return "";

  const header = fields.join(",") + "\n";
  const rows = data.map(item => {
    return fields.map(field => {
      let value = item[field] || "";
      // Handle nested objects (simple)
      if (field.includes('.')) {
        const parts = field.split('.');
        value = item[parts[0]]?.[parts[1]] || "";
      }
      // Escape commas and quotes
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(",");
  }).join("\n");

  return header + rows;
};

/**
 * Express response helper for CSV download.
 */
export const downloadCSV = (res, filename, csv) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.status(200).send(csv);
};
