import { Suspense, use, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import type { RedeemQrResponse } from '@shared/model';
import { errorMessage, redeemQr } from '../lib/firebase';

type Outcome = { ok: true; data: RedeemQrResponse } | { ok: false; message: string };

// Un QR es de un solo uso: si StrictMode o un re-render repiten la llamada, la segunda daría «ya usado».
const pending = new Map<string, Promise<Outcome>>();

function redeem(token: string): Promise<Outcome> {
  let p = pending.get(token);
  if (!p) {
    p = redeemQr({ token }).then(
      ({ data }) => ({ ok: true, data }) as const,
      (err) => ({ ok: false, message: errorMessage(err) }) as const,
    );
    pending.set(token, p);
  }
  return p;
}

export default function Redeem() {
  const { token = '' } = useParams();
  const promise = useMemo(() => redeem(token), [token]);
  return (
    <main className="page">
      <Suspense fallback={<p>Dando el sello…</p>}>
        <Result promise={promise} />
      </Suspense>
      <Link className="button secondary" to="/tarjetas">Ver mis tarjetas</Link>
    </main>
  );
}

function Result({ promise }: { promise: Promise<Outcome> }) {
  const outcome = use(promise);
  if (!outcome.ok) return <p className="notice" role="alert">{outcome.message}</p>;
  const { businessName, amount, cardStamps, stampsRequired, rewardsEarned, reward } = outcome.data;
  return (
    <>
      <h1>{businessName}</h1>
      {rewardsEarned > 0 && <p className="notice"><strong>¡Premio conseguido!</strong> {reward}</p>}
      <p>
        +{amount} {amount === 1 ? 'sello' : 'sellos'}. Llevas {cardStamps} de {stampsRequired}; te{' '}
        {stampsRequired - cardStamps === 1 ? 'falta 1' : `faltan ${stampsRequired - cardStamps}`} para «{reward}».
      </p>
    </>
  );
}
