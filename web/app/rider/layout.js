"use client";
/**
 * Every /rider tab (Home, Map, Deliveries, Earnings, Account) shares one rider
 * workspace: offers keep arriving, location keeps being shared and the offer pop-up
 * shows on whichever tab is open. The bottom nav switches to rider tabs here.
 */
import { RiderJobsProvider } from "@/components/rider/RiderJobsContext";
import RiderOfferSheet from "@/components/rider/RiderOfferSheet";
import { useRiderProfile } from "@/lib/riderProfile";

export default function RiderLayout({ children }) {
  const rider = useRiderProfile();
  const active = rider?.status === "active";
  return (
    <RiderJobsProvider enabled={active}>
      {children}
      {active && <RiderOfferSheet />}
    </RiderJobsProvider>
  );
}
