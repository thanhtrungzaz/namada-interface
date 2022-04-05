import { useEffect, useState } from "react";

import { Config } from "config";
import { RpcClient, SocketClient, Transfer } from "lib";
import { NewBlockEvents, SubscriptionEvents } from "lib/rpc/types";
import { addTransaction } from "slices";
import { DerivedAccountsState } from "slices/accounts";
import { BalancesState, setBalance } from "slices/balances";
import { useAppDispatch, useAppSelector } from "store";
import { amountFromMicro } from "utils/helpers";
import { Tokens, TxResponse } from "constants/";

import { Button, ButtonVariant } from "components/Button";
import { Input, InputVariants } from "components/Input";
import {
  ButtonsContainer,
  InputContainer,
  StatusContainer,
  StatusMessage,
  TokenSendFormContainer,
} from "./TokenSendForm.components";

type Props = {
  hash: string;
  target?: string;
};

const { network, wsNetwork } = new Config();
const rpcClient = new RpcClient(network);
const socketClient = new SocketClient(wsNetwork);

const TokenSendForm = ({ hash, target: defaultTarget }: Props): JSX.Element => {
  const dispatch = useAppDispatch();
  const [target, setTarget] = useState<string | undefined>(defaultTarget);
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<string>();
  const [events, setEvents] = useState<
    { gas: number; hash: string } | undefined
  >();
  const [isTargetValid, setIsTargetValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { derived } = useAppSelector<DerivedAccountsState>(
    (state) => state.accounts
  );
  const { accountBalances } = useAppSelector<BalancesState>(
    (state) => state.balances
  );
  const { token: balance } = accountBalances[hash] || {};
  const account = derived[hash] || {};
  const { alias, establishedAddress = "", tokenType } = account;
  const token = Tokens[tokenType] || {};

  const checkBalance = async (
    token: string,
    owner: string
  ): Promise<number> => {
    return await rpcClient.queryBalance(token, owner);
  };

  const handleFocus = (e: React.ChangeEvent<HTMLInputElement>): void =>
    e.target.select();

  useEffect(() => {
    // Get balance
    (async () => {
      if (establishedAddress && token.address) {
        const balance = await checkBalance(token.address, establishedAddress);
        dispatch(
          setBalance({
            alias,
            token: balance,
            usd: 0,
          })
        );
      }
    })();
  }, [establishedAddress, token.address]);

  useEffect(() => {
    // Validate target address
    (async () => {
      if (target) {
        const isValid = await rpcClient.isKnownAddress(target);
        setIsTargetValid(isValid);
      }
    })();
  }, [target]);

  const handleOnSendClick = async (): Promise<void> => {
    if (target && token.address) {
      setStatus("Submitting token transfer");
      setIsSubmitting(true);

      const epoch = await rpcClient.queryEpoch();
      const transfer = await new Transfer().init();
      const { hash: txHash, bytes } = await transfer.makeTransfer({
        source: establishedAddress,
        target,
        token: token.address,
        amount,
        epoch,
        privateKey: account.signingKey,
      });

      socketClient.broadcastTx(txHash, bytes, {
        onBroadcast: () => {
          setStatus("Successfully connected to ledger");
        },
        onNext: async (subEvent) => {
          const { events }: { events: NewBlockEvents } =
            subEvent as SubscriptionEvents;

          const gas = parseInt(events[TxResponse.GasUsed][0]);
          const appliedHash = events[TxResponse.Hash][0];

          const newBalance = await checkBalance(
            `${token.address}`,
            establishedAddress
          );

          setAmount(0);
          setIsSubmitting(false);
          dispatch(setBalance({ alias, token: newBalance, usd: 0 }));
          dispatch(
            addTransaction({
              hash,
              appliedHash,
              tokenType,
              target,
              amount,
              gas,
              timestamp: new Date().getTime(),
            })
          );
          setStatus(`Successfully transferred ${amount} of ${token.symbol}!`);
          setEvents({
            gas,
            hash: appliedHash,
          });
          socketClient.disconnect();
        },
      });
    }
  };
  return (
    <>
      <TokenSendFormContainer>
        <p>
          {alias} ({tokenType})
        </p>
        <p>
          Balance: <strong>{balance}</strong>
        </p>
        <InputContainer>
          <Input
            variant={InputVariants.Text}
            label="Target address:"
            onChangeCallback={(e) => {
              const { value } = e.target;
              setTarget(value);
            }}
            value={target}
            error={isTargetValid ? undefined : "Target is invalid"}
          />
        </InputContainer>
        <InputContainer>
          <Input
            variant={InputVariants.Number}
            label="Amount:"
            value={amount}
            onChangeCallback={(e) => {
              const { value } = e.target;
              setAmount(parseFloat(`${value}`));
            }}
            onFocus={handleFocus}
            error={amount <= balance ? undefined : "Invalid amount!"}
          />
        </InputContainer>
      </TokenSendFormContainer>
      <ButtonsContainer>
        <Button
          variant={ButtonVariant.Contained}
          disabled={
            amount > balance ||
            target === "" ||
            amount === 0 ||
            !isTargetValid ||
            isSubmitting
          }
          onClick={handleOnSendClick}
        >
          Send
        </Button>
      </ButtonsContainer>
      <StatusContainer>
        {status && <StatusMessage>{status}</StatusMessage>}
        {events && (
          <>
            <StatusMessage>
              Gas used: <strong>{amountFromMicro(events.gas)}</strong>
              <br />
              Applied hash:
            </StatusMessage>
            <pre style={{ background: "#ddd", overflowX: "scroll" }}>
              {events.hash}
            </pre>
          </>
        )}
      </StatusContainer>
    </>
  );
};

export default TokenSendForm;
