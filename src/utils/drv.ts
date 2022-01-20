import { IDRV, IDRVObject } from "../model/shared/derivatives";

// Formatting DRV date
export const DRVDateFormat = (date: string) => {
  if (!date) {
    return date;
  }

  if (date.includes("-")) {
    const day = date.split("-")[2];
    const removeLeadingZeroDay = parseInt(day, 10);
    const month = date.split("-")[1];
    const removeLeadingZeroMonth = parseInt(month, 10);
    const year = date.split("-")[0];
    return (date = `${removeLeadingZeroMonth}/${removeLeadingZeroDay}/${year}`);
  }

  const month = date.split("/")[0];
  const removeLeadingZeroMonth = parseInt(month, 10);
  const day = date.split("/")[1];
  const removeLeadingZeroDay = parseInt(day, 10);
  const year = date.split("/")[2];
  return (date = `${removeLeadingZeroMonth}/${removeLeadingZeroDay}/${year}`);
};

// Modifying DRV expiry to month only
export const DRVExpiryToMonthOnly = (date: string) => {
  if (!date) {
    return date;
  }

  if (date.includes("-")) {
    const month = date.split("-")[1];
    const removeLeadingZeroMonth = parseInt(month, 10);
    return (date = removeLeadingZeroMonth.toString());
  }

  const month = date.split("/")[0];
  const removeLeadingZeroMonth = parseInt(month, 10);
  return (date = removeLeadingZeroMonth.toString());
};

// Modifying DRV expiry to year only
export const DRVExpiryToYearOnly = (date: string) => {
  if (!date) {
    return date;
  }

  if (date.includes("/")) {
    return date.split("/")[2];
  }

  return date.split("-")[0];
};

// Convert DRV to unique dates only
export const DRVUniqueDatesArray = (array: IDRV[]) => {
  if (!array) {
    return array;
  }

  const dates = array.map((date: IDRV) => date.modifiedDate);
  const uniqueDates = dates.filter((item, pos) => dates.indexOf(item) == pos);

  return uniqueDates;
};

// Separate DRV by date
export const DRVSeparateDatesObject = (array: IDRV[]) => {
  if (!array) {
    return array;
  }

  const result: IDRVObject = array.reduce((arr, DRV) => {
    arr[DRV.modifiedDate!] = arr[DRV.modifiedDate!] || [];
    arr[DRV.modifiedDate!].push(DRV);
    return arr;
  }, Object.create(null));
  return result;
};

// Grouping DRV
export const DRVGroupBy = (
  array: IDRV[],
  f: (element: IDRV) => (string | number | undefined)[]
) => {
  const groups: { [key: string]: IDRV[] } = {};

  array.forEach((object) => {
    const group = f(object).join("-");

    groups[group] = groups[group] || [];
    groups[group].push(object);
  });
  return groups;
};

export const equalToOneGroupsDRV = (object: IDRVObject) => {
  const result: IDRVObject = Object.entries(object).reduce(
    (a, b) =>
      (a = {
        ...a,
        ...(b[1].length === 1 ? { [b[0]]: b[1] } : {})
      }),
    {}
  );
  return result;
};

export const biggerThanOneGroupsDRV = (object: IDRVObject) => {
  const result: IDRVObject = Object.entries(object).reduce(
    (a, b) =>
      (a = {
        ...a,
        ...(b[1].length !== 1 ? { [b[0]]: b[1] } : {})
      }),
    {}
  );
  return result;
};
