import {
  Keplr as IKeplr,
  ChainInfo,
  Key,
  Window as KeplrWindow,
} from "@keplr-wallet/types";

import { Chain } from "config";
import { Tokens, TokenType } from "constants/";

const { REACT_APP_LOCAL, NODE_ENV } = process.env;

const BECH32_PREFIX = "namada";
const BECH32_PREFIX_TESTNET = "atest";
const KEPLR_NOT_FOUND = "Keplr extension not found!";

class Keplr {
  /**
   * Pass a chain config into constructor to instantiate, and optionally
   * override keplr instance for testing
   * @param _chain
   * @param _keplr
   */
  constructor(
    private _chain: Chain,
    private _keplr = (<KeplrWindow>window)?.keplr
  ) {}

  /**
   * Keplr extension accessor
   * @returns {IKeplr | undefined}
   */
  public get instance(): IKeplr | undefined {
    return this._keplr;
  }

  /**
   * Chain config accessor
   * @returns {Chain}
   */
  public get chain(): Chain {
    return this._chain;
  }

  /**
   * Determine if keplr extension exists
   * @returns {boolean}
   */
  public detect(): boolean {
    return !!this._keplr;
  }

  /**
   * Determine if chain has been added to extension. Keplr
   * will throw an error if chain is not found
   * @returns {Promise<boolean>}
   */
  public async detectChain(): Promise<boolean> {
    if (this._keplr) {
      try {
        await this._keplr.getOfflineSignerAuto(this._chain.id);
        return true;
      } catch (e) {
        return false;
      }
    }
    return Promise.reject(KEPLR_NOT_FOUND);
  }

  /**
   * Enable connection to Keplr for current chain
   * @returns {Promise<boolean>}
   */
  public async enable(): Promise<boolean> {
    if (this._keplr) {
      const { id } = this._chain;

      await this._keplr.enable(id);
      return true;
    }
    return Promise.reject(KEPLR_NOT_FOUND);
  }

  /**
   * Get key for current chain
   * @returns {Promise<boolean>}
   */
  public async getKey(): Promise<Key> {
    if (this._keplr) {
      const { id } = this._chain;
      return await this._keplr.getKey(id);
    }
    return Promise.reject(KEPLR_NOT_FOUND);
  }

  /**
   * Suggest a chain to Keplr extension
   * @returns {Promise<boolean>}
   */
  public async suggestChain(): Promise<boolean> {
    if (this._keplr) {
      const { id: chainId, alias: chainName, network } = this._chain;
      const { protocol, url, port } = network;
      const rpcUrl = `${protocol}://${url}${port ? ":" + port : ""}`;
      // The following should match our Rest API URL and be added to chain config
      // instead of hard-coding port here:
      const restUrl = `${protocol}://${url}:1317`;
      const bech32Prefix =
        REACT_APP_LOCAL || NODE_ENV === "development"
          ? BECH32_PREFIX_TESTNET
          : BECH32_PREFIX;

      const tokenType: TokenType = "ATOM";
      const token = Tokens[tokenType];
      const { symbol, coinGeckoId } = token;

      const currency = {
        coinDenom: symbol,
        coinMinimalDenom: "uatom", // Add this to Token config?
        coinDecimals: 6,
        coinGeckoId,
      };

      const chainInfo: ChainInfo = {
        rpc: rpcUrl,
        rest: restUrl,
        chainId,
        chainName,
        stakeCurrency: currency,
        bip44: {
          coinType: token.type,
        },
        bech32Config: {
          bech32PrefixAccAddr: bech32Prefix,
          bech32PrefixAccPub: `${bech32Prefix}pub`,
          bech32PrefixValAddr: `${bech32Prefix}valoper`,
          bech32PrefixValPub: `${bech32Prefix}valoperpub`,
          bech32PrefixConsAddr: `${bech32Prefix}valcons`,
          bech32PrefixConsPub: `${bech32Prefix}valconspub`,
        },
        currencies: [currency],
        feeCurrencies: [currency],
        gasPriceStep: { low: 0.01, average: 0.025, high: 0.03 }, // This is optional!
      };

      await this._keplr.experimentalSuggestChain(chainInfo);
      return true;
    }

    return Promise.reject(KEPLR_NOT_FOUND);
  }
}

export default Keplr;
