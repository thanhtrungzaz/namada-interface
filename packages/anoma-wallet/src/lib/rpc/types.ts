import { BroadcastTxSyncResponse } from "@cosmjs/tendermint-rpc";
import { JsonRpcSuccessResponse } from "@cosmjs/json-rpc";
import { SubscriptionEvent } from "@cosmjs/tendermint-rpc/build/rpcclients";
import { TxResponse } from "constants/";

export type AbciResponse = {
  code?: number;
  codespace?: string;
  height?: string;
  index?: string;
  info?: string;
  key?: string;
  log?: string;
  proofOps?: string;
  value?: string;
};

export interface BroadcastSyncResponse extends JsonRpcSuccessResponse {
  result: BroadcastTxSyncResponse;
}

export type SubscriptionParams = {
  onBroadcast?: (response: BroadcastSyncResponse) => void;
  onNext?: (txEvent: SubscriptionEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
};

export interface SubscriptionEvents extends SubscriptionEvent {
  events: NewBlockEvents;
}

export type NewBlockEvents = Record<TxResponse, string>;

export type JsonCompatibleArray = (string | number | boolean)[];
export type JsonCompatibleDictionary = {
  [key: string]: string | JsonCompatibleArray;
};
