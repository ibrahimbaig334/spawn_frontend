import { ProfilePage } from "@/components/profiles/profile-page";

export default async function ProfileRoute({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  return <ProfilePage walletAddress={decodeURIComponent(wallet)} />;
}
