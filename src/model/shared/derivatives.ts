export interface IWEXObject {
  [key: string]: IWEX[];
}

export interface IDRVObject {
  [key: string]: IDRV[];
}

export interface IWEX {
  readonly User?: string;
  readonly Date?: string;
  readonly Route?: string;
  readonly Side?: string;
  readonly "Exec Qty"?: string;
  readonly Security?: string;
  readonly Root?: string;
  readonly Expiry?: string;
  readonly Strike?: string;
  readonly "Call/Put"?: string;
  readonly "Average Price"?: string;
  readonly Portfolio?: string;
  readonly "Commission Type"?: string;
  readonly "Commission Rate"?: string;
  readonly "WEX Connect Rate"?: string;
  readonly "Exch. Fee Rate"?: string;
  readonly "Clearing Fee"?: string;
  readonly "Total Charge"?: string;
  modifiedDate?: string;
  modifiedUser?: string;
  modifiedSide?: string;
  modifiedExecQty?: number;
  modifiedSecurity?: string;
  modifiedRoot?: string;
  modifiedExpiry?: string;
  modifiedStrike?: number;
  modifiedCallPut?: string;
  modifiedAveragePrice?: number;
  modifiedPortfolio?: string;
  modifiedCommissionType?: string;
  modifiedCommissionRate?: number;
  modifiedTotalCharge?: number;
  removed?: boolean;
  drv_trade_client_account_execution_id?: string;
  drv_trade_floor_broker_id?: number;
  charge?: number;
  modifiedQuantity?: number;
  drv_trade_id?: string;
  floor_broker?: string;
  component_type?: string;
  contract_type?: string;
  modifiedSymbol?: string;
  modifiedOption?: string;
  client_id?: string;
}

export interface IDRV {
  drv_trade_id?: string;
  drv_trade_client_trader_id?: string;
  drv_trade_client_account_execution_id?: string;
  floor_broker?: string;
  date?: string;
  side?: string;
  quantity?: string;
  component_type?: string;
  contract_type?: string;
  symbol?: string;
  expiry?: string;
  strike?: string;
  option?: string;
  price?: string;
  client_id?: string;
  client?: string;
  trader?: string;
  modifiedDate?: string;
  modifiedSide?: string;
  modifiedQuantity?: number;
  modifiedSymbol?: string;
  modifiedExpiry?: string;
  modifiedStrike?: number;
  modifiedOption?: string;
  modifiedPrice?: number;
  charge?: number;
  quantitySum?: number;
}

export interface IMatchedRows {
  drv_trade_floor_broker_id?: string;
  drv_trade_client_account_execution_id?: string;
  charge?: number;
  rule?: string;
}
