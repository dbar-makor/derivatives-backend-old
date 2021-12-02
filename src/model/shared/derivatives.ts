export type IWEXInterfaceArrayOfArrays = {
  [key: string]: IWEXInterface[];
};

export interface IWEXInterface {
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
  readonly "WEX Connect Rate"?: string;
  readonly "Exch. Fee Rate"?: string;
  readonly "Clearing Fee"?: string;
  readonly "Total Charge"?: string;
}

export interface IDRVInterface {
  readonly drv_trade_id?: string;
  readonly drv_trade_client_trader_id?: string;
  readonly drv_trade_client_account_execution_id?: string;
  readonly floor_broker?: string;
  readonly date?: string;
  readonly side?: string;
  readonly quantity?: string;
  readonly component_type?: string;
  readonly contract_type?: string;
  readonly symbol?: string;
  readonly expiry?: string;
  readonly strike?: string;
  readonly option?: string;
  readonly price?: string;
  readonly client_id?: string;
  readonly client?: string;
  readonly trader?: string;
}
