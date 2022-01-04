import { IDRV, IDRVObject } from "../model/shared/derivatives";

// Formatting DRV expiry
export const DRVExpiryFormat = (date: string) => {
  if (!date) {
    return date;
  }
  const day = date.toString().split("-")[2];
  const removeLeadingZeroDay = parseInt(day, 10);
  const month = date.toString().split("-")[1];
  const removeLeadingZeroMonth = parseInt(month, 10);
  const year = date.toString().split("-")[0];
  return (date = `${removeLeadingZeroMonth}/${removeLeadingZeroDay}/${year}`);
};

// Formatting DRV date
export const DRVDateFormat = (date: string) => {
  if (!date) {
    return date;
  }
  const day = date.split("/")[0];
  const removeLeadingZeroDay = parseInt(day, 10);
  const month = date.split("/")[1];
  const removeLeadingZeroMonth = parseInt(month, 10);
  const year = date.split("/")[2];
  return (date = `${removeLeadingZeroDay}/${removeLeadingZeroMonth}/${year}`);
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
