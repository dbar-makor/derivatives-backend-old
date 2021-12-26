import { IDRVInterface } from "../model/shared/derivatives";

// Formatting DRV date
export const formatDRVDate = (date: string) => {
  const splitedMonth = date.split("/")[0];
  const removeLeadingZeroMonth = parseInt(splitedMonth, 10);
  const checkIfRemoveLeadingZeroMonth = isNaN(removeLeadingZeroMonth)
    ? ""
    : removeLeadingZeroMonth;
  const splitedDayAndYear = date.substring(date.indexOf("/"));
  return (date = `${checkIfRemoveLeadingZeroMonth}${splitedDayAndYear}`);
};

// Grouping DRV array
export const DRVGroupBy = (
  array: IDRVInterface[],
  f: (element: IDRVInterface) => (string | undefined)[]
) => {
  const groups: { [key: string]: IDRVInterface[] } = {};

  array.forEach((object) => {
    const group = f(object).join("-");

    groups[group] = groups[group] || [];
    groups[group].push(object);
  });
  return groups;
};
