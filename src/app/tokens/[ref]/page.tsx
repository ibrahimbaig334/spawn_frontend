import { TokenDetailPage } from "@/components/tokens/token-detail-page";

/**
 * :tokenRef accepts the poolId (0x…66), the token contract address (0x…42),
 * or the offchain token UUID (guide §1.1).
 */
export default async function TokenRoute({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <TokenDetailPage tokenRef={decodeURIComponent(ref)} />;
}
