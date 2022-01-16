import { IDRVObject } from "../model/shared/derivatives";

// Convert string to number and remove commas
export const removeCommas = (element: string | undefined) => {
  if (!element) {
    return element;
  }

  const output = parseFloat(element.toString().replace(/,/g, ""));
  return output;
};

export const equalToOneGroups = (object: IDRVObject) => {
  const result: IDRVObject = Object.entries(object).reduce(
    (a, b) =>
      (a = {
        ...a,
        ...(b[1].length === 1 ? { [b[0]]: b[1] } : {}),
      }),
    {},
  );
  return result;
};

export const biggerThanOneGroups = (object: IDRVObject) => {
  const result: IDRVObject = Object.entries(object).reduce(
    (a, b) =>
      (a = {
        ...a,
        ...(b[1].length !== 1 ? { [b[0]]: b[1] } : {}),
      }),
    {},
  );
  return result;
};
