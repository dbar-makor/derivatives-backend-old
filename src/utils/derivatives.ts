import { IDRV, IDASH, IWEX, IBAML } from "../model/shared/derivatives";

// Convert string to number and remove commas
export const removeCommas = (element: string | undefined) => {
  if (!element) {
    return element;
  }

  const output = parseFloat(element.replace(/,/g, ""));
  return output;
};

// Separate groups
export const separateGroups = (element: IDRV[] | IDASH[] | IWEX[] | IBAML[]) =>
  element.map((e) => e.groupsSeparated).flat();
