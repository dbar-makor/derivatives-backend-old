import { IBAML, IBAMLObject } from "../model/shared/derivatives";

// Format BAML date
export const BAMLDateFormat = (date: string) => {
  let addLeadingNumbersYear = "";
  if (!date) {
    return date;
  }

  const day = date.split("/")[0];
  const removeLeadingZeroDay = parseInt(day, 10);
  const month = date.toString().split("/")[1];
  const removeLeadingZeroMonth = parseInt(month, 10);
  const year = date.toString().split("/")[2];
  if (year.length === 2) {
    addLeadingNumbersYear = `20${year}`;
  } else {
    addLeadingNumbersYear = year;
  }

  return (date = `${removeLeadingZeroDay}/${removeLeadingZeroMonth}/${addLeadingNumbersYear}`);
};

// Grouping BAML array
export const BAMLGroupBy = (
  array: IBAML[],
  f: (element: IBAML) => (string | number | undefined)[],
) => {
  if (!array) {
    return array;
  }

  const groups: { [key: string]: IBAML[] } = {};

  array.forEach((object) => {
    const group = f(object).join("-");

    groups[group] = groups[group] || [];
    groups[group].push(object);
  });
  return groups;
};

// Convert BAML to unique dates only
export const BAMLUniqueDatesArray = (array: IBAML[]) => {
  if (!array) {
    return array;
  }

  const dates = array.map((date: IBAML) => date.modifiedTradeDate);
  const uniqueDates = dates.filter((item, pos) => dates.indexOf(item) == pos);

  return uniqueDates;
};

// Separate BAML Array by date
export const BAMLSeparateDatesObject = (array: IBAML[]) => {
  if (!array) {
    return array;
  }

  const result: IBAMLObject = array.reduce((arr, BAML) => {
    arr[BAML.modifiedTradeDate!] = arr[BAML.modifiedTradeDate!] || [];
    arr[BAML.modifiedTradeDate!].push(BAML);
    return arr;
  }, Object.create(null));
  return result;
};

// Modify total charge
export const BAMLModifiyTotalCharge = (totalCharge: string) => {
  if (!totalCharge) {
    return 0;
  }

  if (totalCharge.includes("(")) {
    return -Math.abs(Number(totalCharge.replace(/[()]/g, "")));
  }

  return Number(totalCharge);
};

export const equalToOneGroupsBAML = (object: IBAMLObject) => {
  const result: IBAMLObject = Object.entries(object).reduce(
    (a, b) =>
      (a = {
        ...a,
        ...(b[1].length === 1 ? { [b[0]]: b[1] } : {}),
      }),
    {},
  );
  return result;
};

export const biggerThanOneGroupsBAML = (object: IBAMLObject) => {
  const result: IBAMLObject = Object.entries(object).reduce(
    (a, b) =>
      (a = {
        ...a,
        ...(b[1].length !== 1 ? { [b[0]]: b[1] } : {}),
      }),
    {},
  );
  return result;
};
