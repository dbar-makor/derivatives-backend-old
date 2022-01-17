// Convert string to number and remove commas
export const removeCommas = (element: string | undefined) => {
  if (!element) {
    return element;
  }

  const output = parseFloat(element.toString().replace(/,/g, ""));
  return output;
};
