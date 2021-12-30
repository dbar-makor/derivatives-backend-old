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

// Separate DRV by date
export const DRVDatesObject = (array: IDRV[]) => {
  const result: IDRVObject = array.reduce((arr, WEX) => {
    arr[WEX.modifiedDate!] = arr[WEX.modifiedDate!] || [];
    arr[WEX.modifiedDate!].push(WEX);
    return arr;
  }, Object.create(null));
  return result;
};
