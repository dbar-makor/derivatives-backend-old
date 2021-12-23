// Convert string to number and remove commas
export const removeCommas = (element: string) => {
  const output = parseFloat(element.replace(/,/g, ""));
  return output;
};
