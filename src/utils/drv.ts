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
